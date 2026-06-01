import {
  BYTES32_LENGTH,
  U128_MAX,
  U16_MAX,
  U64_MAX,
  U8_MAX,
  VERU_PCC_VAULT_CLAIM_FUNCTION,
  VERU_PCC_VAULT_PROGRAM_NAME,
  VERU_PCC_VAULT_WITHDRAW_FUNCTION,
} from '@/constants/veru-pcc-vault';
import type { AleoNetwork } from '@/types/derivation';
import type { SdkModule } from '@/types/scanner';
import type {
  AleoExecuteOptions,
  AleoExecutionResult,
  AleoTransactionReceipt,
  AleoWaitForReceiptOptions,
} from '@/types/wallet';
import { ValidationError, WalletError } from '@/utils/errors';
import type { AleoWalletProvider } from '@/wallet/aleo-wallet-provider';

/** Per-call options for any `VeruPccVault` transition — everything except program/function/inputs. */
export type VeruPccVaultCallOptions = Omit<
  AleoExecuteOptions,
  'programName' | 'functionName' | 'inputs'
>;

/** Accepted numeric input form for any unsigned Aleo integer. */
export type Uint = bigint | number | string;
/** Accepted form for an Aleo `field` literal — already-stringified literals (`"1field"`) are passed through. */
export type FieldLike = bigint | number | string;
/** Accepted form for an Aleo `[u8; 32]` literal. */
export type Bytes32Like = Uint8Array | readonly number[] | string;

/**
 * Mirrors the `Payload` struct in `veru_pcc_vault.aleo`:
 *
 * ```leo
 * struct Payload {
 *   source_chain_id: u128,
 *   source_token_id: field,
 *   source_amount: u128,
 *   aleo_binding: address,
 *   destination_token_id: field,
 *   nonce: field
 * }
 * ```
 */
export interface VeruPccVaultPayload {
  readonly sourceChainId: Uint;
  readonly sourceTokenId: FieldLike;
  readonly sourceAmount: Uint;
  readonly aleoBinding: string;
  readonly destinationTokenId: FieldLike;
  readonly nonce: FieldLike;
}

/**
 * Arguments to `claim(payload, receiver_address, claimable_amount, expec_commitment_hash)`.
 * `payload.aleoBinding` must equal the wallet's signing address — the on-chain
 * transition asserts `self.caller == payload.aleo_binding`.
 */
export interface VeruPccVaultClaimParams {
  readonly payload: VeruPccVaultPayload;
  readonly receiverAddress: string;
  readonly claimableAmount: Uint;
  readonly expectedCommitmentHash: Bytes32Like;
}

/**
 * Arguments to `withdraw(...)`. `token` must be a `token_registry.aleo::Token`
 * record literal owned by the caller; the SDK passes it through as-is so the
 * record's plaintext (or ciphertext alias) is the caller's responsibility.
 */
export interface VeruPccVaultWithdrawParams {
  /** `token_registry.aleo::Token` record literal — passed verbatim as a private input. */
  readonly token: string;
  readonly connSn: Uint;
  readonly data: Bytes32Like;
  readonly feeAmount: Uint;
  /** Basis points (0–10000). */
  readonly feeBpsParam: number;
  readonly amountSend: Uint;
  readonly hubChainId: Uint;
  readonly hubAddress: Bytes32Like;
  readonly destReceiverAddrs: Bytes32Like;
  readonly nonce: FieldLike;
  readonly fallbackReceiverAddress: string;
  readonly gmpFee: Uint;
}

/**
 * Typed wrapper around `veru_pcc_vault.aleo`. Encodes the program name, function
 * names, and input signatures for the user-facing transitions `claim` and
 * `withdraw`, then delegates to a generic `AleoWalletProvider#execute` after
 * validating each input fits its Aleo type.
 *
 * Only the user-driven transitions are exposed here. Council/relayer
 * transitions (`initialize`, `set_fee_bps`, `set_relayer_status`, `recv_message`,
 * `refund`, `make_wallet`) are intentionally not wrapped — they're invoked from
 * other actors and should not be reachable through the user SDK.
 */
export class VeruPccVault {
  constructor(private readonly wallet: AleoWalletProvider) {}

  /** Call `claim(payload, receiver_address, claimable_amount, expec_commitment_hash)`. */
  claim(
    params: VeruPccVaultClaimParams,
    options: VeruPccVaultCallOptions = {},
  ): Promise<AleoExecutionResult> {
    return this.wallet.execute({ ...options, ...buildClaimCall(params) });
  }

  /** Call `claim(...)` and block until the network confirms the transaction. */
  claimAndWait(
    params: VeruPccVaultClaimParams,
    options: VeruPccVaultCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    return this.wallet.executeAndWait({ ...options, ...buildClaimCall(params) }, receiptOptions);
  }

  /** Call `withdraw(...)`. */
  withdraw(
    params: VeruPccVaultWithdrawParams,
    options: VeruPccVaultCallOptions = {},
  ): Promise<AleoExecutionResult> {
    return this.wallet.execute({ ...options, ...buildWithdrawCall(params) });
  }

  /** Call `withdraw(...)` and block until the network confirms the transaction. */
  withdrawAndWait(
    params: VeruPccVaultWithdrawParams,
    options: VeruPccVaultCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    return this.wallet.executeAndWait(
      { ...options, ...buildWithdrawCall(params) },
      receiptOptions,
    );
  }

  /**
   * Compute the BHP256 commitment hash of a Payload struct, matching the
   * on-chain derivation used by `claim`:
   *
   * ```leo
   * let hashed_value: field = BHP256::hash_to_field(payload);
   * let serialized_hashed_value: [bool; 253] = Serialize::to_bits_raw(hashed_value);
   * let payload_hash: [u8; 32] = bit256_to_bytes32(bit253_to_256bits(serialized_hashed_value));
   * ```
   *
   * Returns the 32-byte commitment as a `Uint8Array`. Use the result for both
   * sides of the GMP pipeline: the relayer feeds it into `recv_message` so the
   * `commitments` mapping is populated, and the user feeds the same value into
   * `claim`'s `expectedCommitmentHash`.
   *
   * Lazy-loads `@provablehq/sdk` for the given network — `WalletError` is
   * thrown if the optional peer dep isn't installed.
   */
  static async computePayloadCommitmentHash(
    payload: VeruPccVaultPayload,
    network: AleoNetwork,
  ): Promise<Uint8Array> {
    const sdk = await loadProvableSdk(network);
    const plaintext = sdk.Plaintext.fromString(formatPayload(payload));
    const bits = plaintext.toBitsLe();
    const hasher = new sdk.BHP256();
    const hashField = hasher.hash(bits);
    const bytes = hashField.toBytesLe();
    if (bytes.length !== BYTES32_LENGTH) {
      throw new ValidationError(
        `Unexpected BHP256 hash byte length ${bytes.length}, expected ${BYTES32_LENGTH}.`,
      );
    }
    return bytes.reverse();
  }
}

async function loadProvableSdk(network: AleoNetwork): Promise<SdkModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as SdkModule;
  } catch (err) {
    throw new WalletError(
      `VeruPccVault.computePayloadCommitmentHash requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

function buildClaimCall(
  params: VeruPccVaultClaimParams,
): Pick<AleoExecuteOptions, 'programName' | 'functionName' | 'inputs'> {
  const payloadLiteral = formatPayload(params.payload);
  const receiver = assertAddress(params.receiverAddress, 'receiverAddress');
  const claimable = formatUnsigned(params.claimableAmount, 'claimableAmount', 128, U128_MAX);
  const commitment = formatBytes32(params.expectedCommitmentHash, 'expectedCommitmentHash');
  return {
    programName: VERU_PCC_VAULT_PROGRAM_NAME,
    functionName: VERU_PCC_VAULT_CLAIM_FUNCTION,
    inputs: [payloadLiteral, receiver, claimable, commitment],
  };
}

function buildWithdrawCall(
  params: VeruPccVaultWithdrawParams,
): Pick<AleoExecuteOptions, 'programName' | 'functionName' | 'inputs'> {
  if (typeof params.token !== 'string' || params.token.length === 0) {
    throw new ValidationError('token must be a non-empty token_registry.aleo::Token record literal.');
  }
  return {
    programName: VERU_PCC_VAULT_PROGRAM_NAME,
    functionName: VERU_PCC_VAULT_WITHDRAW_FUNCTION,
    inputs: [
      params.token,
      formatUnsigned(params.connSn, 'connSn', 128, U128_MAX),
      formatBytes32(params.data, 'data'),
      formatUnsigned(params.feeAmount, 'feeAmount', 64, U64_MAX),
      formatUnsigned(params.feeBpsParam, 'feeBpsParam', 16, U16_MAX),
      formatUnsigned(params.amountSend, 'amountSend', 64, U64_MAX),
      formatUnsigned(params.hubChainId, 'hubChainId', 128, U128_MAX),
      formatBytes32(params.hubAddress, 'hubAddress'),
      formatBytes32(params.destReceiverAddrs, 'destReceiverAddrs'),
      formatField(params.nonce, 'nonce'),
      assertAddress(params.fallbackReceiverAddress, 'fallbackReceiverAddress'),
      formatUnsigned(params.gmpFee, 'gmpFee', 128, U128_MAX),
    ],
  };
}

function formatPayload(payload: VeruPccVaultPayload): string {
  const sourceChainId = formatUnsigned(payload.sourceChainId, 'payload.sourceChainId', 128, U128_MAX);
  const sourceTokenId = formatField(payload.sourceTokenId, 'payload.sourceTokenId');
  const sourceAmount = formatUnsigned(payload.sourceAmount, 'payload.sourceAmount', 128, U128_MAX);
  const aleoBinding = assertAddress(payload.aleoBinding, 'payload.aleoBinding');
  const destinationTokenId = formatField(payload.destinationTokenId, 'payload.destinationTokenId');
  const nonce = formatField(payload.nonce, 'payload.nonce');
  return (
    '{' +
    `source_chain_id: ${sourceChainId}, ` +
    `source_token_id: ${sourceTokenId}, ` +
    `source_amount: ${sourceAmount}, ` +
    `aleo_binding: ${aleoBinding}, ` +
    `destination_token_id: ${destinationTokenId}, ` +
    `nonce: ${nonce}` +
    '}'
  );
}

function formatUnsigned(value: Uint, paramName: string, bits: 8 | 16 | 32 | 64 | 128, max: bigint): string {
  const n = toBigInt(value, paramName);
  if (n < 0n || n > max) {
    throw new ValidationError(`${paramName} must be in [0, ${max.toString()}] (u${bits}), received ${n.toString()}.`);
  }
  return `${n.toString()}u${bits}`;
}

function formatField(value: FieldLike, paramName: string): string {
  if (typeof value === 'string') {
    // Accept a literal like "123field" or a bare numeric string.
    if (value.endsWith('field')) {
      const numeric = value.slice(0, -'field'.length);
      assertNonNegativeIntegerString(numeric, paramName);
      return value;
    }
    assertNonNegativeIntegerString(value, paramName);
    return `${value}field`;
  }
  const n = toBigInt(value, paramName);
  if (n < 0n) {
    throw new ValidationError(`${paramName} must be a non-negative field, received ${n.toString()}.`);
  }
  return `${n.toString()}field`;
}

function formatBytes32(value: Bytes32Like, paramName: string): string {
  if (typeof value === 'string') {
    const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== BYTES32_LENGTH * 2) {
      throw new ValidationError(`${paramName} must be a ${BYTES32_LENGTH}-byte hex string.`);
    }
    const bytes = new Uint8Array(BYTES32_LENGTH);
    for (let i = 0; i < BYTES32_LENGTH; i += 1) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return formatByteArrayLiteral(bytes);
  }
  const arr = value instanceof Uint8Array ? value : Uint8Array.from(value);
  if (arr.length !== BYTES32_LENGTH) {
    throw new ValidationError(`${paramName} must be exactly ${BYTES32_LENGTH} bytes, received ${arr.length}.`);
  }
  for (let i = 0; i < arr.length; i += 1) {
    const byte = arr[i] as number;
    if (!Number.isInteger(byte) || byte < 0 || byte > Number(U8_MAX)) {
      throw new ValidationError(`${paramName}[${i}] must be a u8 in [0, 255], received ${String(byte)}.`);
    }
  }
  return formatByteArrayLiteral(arr);
}

function formatByteArrayLiteral(bytes: Uint8Array): string {
  const parts = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) parts[i] = `${bytes[i] as number}u8`;
  return `[${parts.join(', ')}]`;
}

function assertAddress(value: string, paramName: string): string {
  if (typeof value !== 'string' || !value.startsWith('aleo1')) {
    throw new ValidationError(`${paramName} must be an Aleo address (aleo1…), received ${String(value)}.`);
  }
  return value;
}

function toBigInt(value: Uint, paramName: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new ValidationError(`${paramName} must be an integer, received ${String(value)}.`);
    }
    return BigInt(value);
  }
  if (typeof value === 'string') {
    assertNonNegativeIntegerString(value, paramName);
    return BigInt(value);
  }
  throw new ValidationError(`${paramName} must be bigint | number | string, received ${typeof value}.`);
}

function assertNonNegativeIntegerString(value: string, paramName: string): void {
  if (!/^[0-9]+$/.test(value)) {
    throw new ValidationError(`${paramName} must be a non-negative integer string, received '${value}'.`);
  }
}
