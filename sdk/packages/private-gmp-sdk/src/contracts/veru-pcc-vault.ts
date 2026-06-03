import { BYTES32_LENGTH, U128_MAX, U16_MAX, U64_MAX } from '@/constants/aleo-literals';
import {
  VERU_PCC_VAULT_CLAIM_FUNCTION,
  VERU_PCC_VAULT_COMMITMENTS_MAPPING,
  VERU_PCC_VAULT_PROGRAM_NAME,
  VERU_PCC_VAULT_REFUND_FUNCTION,
  VERU_PCC_VAULT_WITHDRAW_COMMITMENT_MAPPING,
  VERU_PCC_VAULT_WITHDRAW_FUNCTION,
} from '@/constants/veru-pcc-vault';
import { MappingReader } from '@/mappings/mapping-reader';
import type { AleoNetwork } from '@/types/derivation';
import type { SdkModule } from '@/types/scanner';
import type {
  VeruPccVaultCallOptions,
  VeruPccVaultClaimParams,
  VeruPccVaultPayload,
  VeruPccVaultRefundParams,
  VeruPccVaultWithdrawParams,
} from '@/types/veru-pcc-vault';
import type {
  AleoExecuteOptions,
  AleoExecutionResult,
  AleoTransactionReceipt,
  AleoWaitForReceiptOptions,
} from '@/types/wallet';
import { assertAddress, formatBytes32, formatField, formatUnsigned } from '@/utils/aleo-literals';
import { ValidationError, WalletError } from '@/utils/errors';
import type { AleoWalletProvider } from '@/wallet/aleo-wallet-provider';

// Re-export the public types from their home in `@/types` so consumers can keep
// importing them from the contract entrypoint (see `contracts/index.ts`).
export type { Bytes32Like, FieldLike, Uint } from '@/types/aleo-literals';
export type {
  VeruPccVaultCallOptions,
  VeruPccVaultClaimParams,
  VeruPccVaultPayload,
  VeruPccVaultRefundParams,
  VeruPccVaultWithdrawParams,
} from '@/types/veru-pcc-vault';

/** A built program/function/inputs triple, ready to hand to `AleoWalletProvider#execute`. */
type AleoCall = Pick<AleoExecuteOptions, 'programName' | 'functionName' | 'inputs'>;

/**
 * Typed wrapper around `veru_pcc_vault.aleo`. Encodes the program name, function
 * names, and input signatures for the user-facing transitions `claim`,
 * `withdraw`, and `refund`, then delegates to a generic
 * `AleoWalletProvider#execute` after validating each input fits its Aleo type.
 *
 * Only the user-driven transitions are exposed here. Council/relayer
 * transitions (`initialize`, `set_fee_bps`, `set_relayer_status`, `recv_message`,
 * `make_wallet`) are intentionally not wrapped — they're invoked from
 * other actors and should not be reachable through the user SDK.
 */
export class VeruPccVault {
  private readonly mappingReader = new MappingReader();

  constructor(private readonly wallet: AleoWalletProvider) {}

  /**
   * Call `claim(payload, receiver_address, claimable_amount, expec_commitment_hash)`.
   *
   * Pre-flight: reads `commitments[expectedCommitmentHash]` and only proceeds
   * when the entry exists with `status == false`. A missing entry (the relayer
   * hasn't registered it via `recv_message` yet) or an already-claimed entry
   * (`status == true`) is rejected with a {@link ValidationError} so the caller
   * fails fast instead of paying for a transaction the on-chain finalize would
   * reject.
   */
  async claim(
    params: VeruPccVaultClaimParams,
    options: VeruPccVaultCallOptions = {},
  ): Promise<AleoExecutionResult> {
    await this.assertCommitmentClaimable(params);
    return this.wallet.execute({ ...options, ...buildClaimCall(params) });
  }

  /** Call `claim(...)` and block until the network confirms the transaction. */
  async claimAndWait(
    params: VeruPccVaultClaimParams,
    options: VeruPccVaultCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    await this.assertCommitmentClaimable(params);
    return this.wallet.executeAndWait({ ...options, ...buildClaimCall(params) }, receiptOptions);
  }

  /**
   * Read the on-chain `commitments` mapping for this claim's commitment hash and
   * assert it is claimable right now. The commitment must exist with
   * `status == false`; anything else throws:
   * - absent entry → not registered yet, "cannot be claimed right now"
   * - `status == true` → "already claimed"
   */
  private async assertCommitmentClaimable(params: VeruPccVaultClaimParams): Promise<void> {
    const key = formatBytes32(params.expectedCommitmentHash, 'expectedCommitmentHash');
    const value = await this.mappingReader.readAleoMapping({
      network: this.wallet.network,
      rpcUrl: this.wallet.rpcUrl,
      program: VERU_PCC_VAULT_PROGRAM_NAME,
      mapping: VERU_PCC_VAULT_COMMITMENTS_MAPPING,
      key,
    });
    const where = `${VERU_PCC_VAULT_PROGRAM_NAME}/${VERU_PCC_VAULT_COMMITMENTS_MAPPING}[${key}]`;
    const status = parseCommitmentStatus(value);
    if (status === null) {
      throw new ValidationError(
        `Commitment cannot be claimed right now: no entry found at ${where}. The relayer has not registered this commitment yet (via recv_message) — wait for it to be available before claiming.`,
      );
    }
    if (status === true) {
      throw new ValidationError(
        `Commitment has already been claimed (${where}.status == true); refusing to submit a duplicate claim.`,
      );
    }
  }

  /**
   * Call `withdraw(...)`.
   *
   * Pre-flight: reads `withdraw_commitment[expectedCommitmentHash]` and only
   * proceeds when the slot is empty. A non-null entry means an intent with this
   * commitment is already in flight (`Withdraw{ ..., intent_status: PENDING }`),
   * so the withdraw is rejected with a {@link ValidationError} before paying for
   * a transaction the on-chain finalize would reject.
   */
  async withdraw(
    params: VeruPccVaultWithdrawParams,
    options: VeruPccVaultCallOptions = {},
  ): Promise<AleoExecutionResult> {
    await this.assertWithdrawCommitmentAbsent(params);
    return this.wallet.execute({ ...options, ...buildWithdrawCall(params) });
  }

  /** Call `withdraw(...)` and block until the network confirms the transaction. */
  async withdrawAndWait(
    params: VeruPccVaultWithdrawParams,
    options: VeruPccVaultCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    await this.assertWithdrawCommitmentAbsent(params);
    return this.wallet.executeAndWait({ ...options, ...buildWithdrawCall(params) }, receiptOptions);
  }

  /**
   * Read the on-chain `withdraw_commitment` mapping for this intent's commitment
   * hash and assert the slot is free. The mapping is `[u8; 32] => Withdraw`; an
   * entry only exists once an intent has been registered, so:
   * - absent entry (`null`) → slot is free, the withdraw may proceed
   * - present entry → intent already in flight, throws {@link ValidationError}
   */
  private async assertWithdrawCommitmentAbsent(
    params: VeruPccVaultWithdrawParams,
  ): Promise<void> {
    const key = formatBytes32(params.expectedCommitmentHash, 'expectedCommitmentHash');
    const value = await this.mappingReader.readAleoMapping({
      network: this.wallet.network,
      rpcUrl: this.wallet.rpcUrl,
      program: VERU_PCC_VAULT_PROGRAM_NAME,
      mapping: VERU_PCC_VAULT_WITHDRAW_COMMITMENT_MAPPING,
      key,
    });
    const where = `${VERU_PCC_VAULT_PROGRAM_NAME}/${VERU_PCC_VAULT_WITHDRAW_COMMITMENT_MAPPING}[${key}]`;
    if (!isEmptyMappingValue(value)) {
      throw new ValidationError(
        `Withdraw commitment already exists at ${where} (${value.trim()}); an intent with this commitment is already in flight. Refusing to submit a duplicate withdraw.`,
      );
    }
  }

  /** Call `refund(source_token_id, source_amount, nonce)`. */
  refund(
    params: VeruPccVaultRefundParams,
    options: VeruPccVaultCallOptions = {},
  ): Promise<AleoExecutionResult> {
    return this.wallet.execute({ ...options, ...buildRefundCall(params) });
  }

  /** Call `refund(...)` and block until the network confirms the transaction. */
  refundAndWait(
    params: VeruPccVaultRefundParams,
    options: VeruPccVaultCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    return this.wallet.executeAndWait({ ...options, ...buildRefundCall(params) }, receiptOptions);
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

/* -------------------------------------------------------------------------- */
/*  Call builders — map typed params to a validated program/function/inputs   */
/* -------------------------------------------------------------------------- */

function buildClaimCall(params: VeruPccVaultClaimParams): AleoCall {
  return {
    programName: VERU_PCC_VAULT_PROGRAM_NAME,
    functionName: VERU_PCC_VAULT_CLAIM_FUNCTION,
    inputs: [
      formatPayload(params.payload),
      assertAddress(params.receiverAddress, 'receiverAddress'),
      formatUnsigned(params.claimableAmount, 'claimableAmount', 128, U128_MAX),
      formatBytes32(params.expectedCommitmentHash, 'expectedCommitmentHash'),
    ],
  };
}

function buildWithdrawCall(params: VeruPccVaultWithdrawParams): AleoCall {
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

function buildRefundCall(params: VeruPccVaultRefundParams): AleoCall {
  return {
    programName: VERU_PCC_VAULT_PROGRAM_NAME,
    functionName: VERU_PCC_VAULT_REFUND_FUNCTION,
    inputs: [
      formatField(params.sourceTokenId, 'sourceTokenId'),
      formatUnsigned(params.sourceAmount, 'sourceAmount', 128, U128_MAX),
      formatField(params.nonce, 'nonce'),
    ],
  };
}

/**
 * Extract the `status` boolean from a `commitments` mapping value.
 *
 * `getProgramMappingValue` returns the `CommitmentData` plaintext literal (e.g.
 * `{ token: 1field, amount: 100u128, status: true }`) or `"null"` for an absent
 * key. Returns the parsed boolean, or `null` when the entry is absent or the
 * value can't be parsed — both of which the caller treats as "not claimable".
 */
function parseCommitmentStatus(value: string | null | undefined): boolean | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === 'null') return null;
  const match = /status\s*:\s*(true|false)/.exec(trimmed);
  if (!match) return null;
  return match[1] === 'true';
}

/**
 * Whether a mapping read returned "no entry". `getProgramMappingValue` yields
 * the literal string `"null"` (or an empty/whitespace string) for an absent
 * key, and the stored struct literal otherwise. Treats both `null`/`undefined`
 * and the `"null"` sentinel as empty.
 */
function isEmptyMappingValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === 'null';
}

/** Render a `Payload` struct as its Aleo literal, validating every field. */
function formatPayload(payload: VeruPccVaultPayload): string {
  const fields = {
    source_chain_id: formatUnsigned(payload.sourceChainId, 'payload.sourceChainId', 128, U128_MAX),
    source_token_id: formatField(payload.sourceTokenId, 'payload.sourceTokenId'),
    source_amount: formatUnsigned(payload.sourceAmount, 'payload.sourceAmount', 128, U128_MAX),
    aleo_binding: assertAddress(payload.aleoBinding, 'payload.aleoBinding'),
    destination_token_id: formatField(payload.destinationTokenId, 'payload.destinationTokenId'),
    nonce: formatField(payload.nonce, 'payload.nonce'),
  };
  const body = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `{${body}}`;
}

/** Lazy-load the network-specific `@provablehq/sdk` WASM build (optional peer dep). */
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
