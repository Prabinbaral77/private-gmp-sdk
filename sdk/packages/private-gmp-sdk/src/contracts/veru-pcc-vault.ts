import { BYTES32_LENGTH, U128_MAX, U16_MAX, U64_MAX } from '@/constants/aleo-literals';
import {
  VERU_PCC_VAULT_CLAIM_FUNCTION,
  VERU_PCC_VAULT_PROGRAM_NAME,
  VERU_PCC_VAULT_WITHDRAW_FUNCTION,
} from '@/constants/veru-pcc-vault';
import type { AleoNetwork } from '@/types/derivation';
import type { SdkModule } from '@/types/scanner';
import type {
  VeruPccVaultCallOptions,
  VeruPccVaultClaimParams,
  VeruPccVaultPayload,
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
  VeruPccVaultWithdrawParams,
} from '@/types/veru-pcc-vault';

/** A built program/function/inputs triple, ready to hand to `AleoWalletProvider#execute`. */
type AleoCall = Pick<AleoExecuteOptions, 'programName' | 'functionName' | 'inputs'>;

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
    return this.wallet.executeAndWait({ ...options, ...buildWithdrawCall(params) }, receiptOptions);
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
