import type { Bytes32Like, FieldLike, Uint } from '@/types/aleo-literals';
import type { AleoExecuteOptions } from '@/types/wallet';

/**
 * Public types for the `veru_pcc_vault.aleo` wrapper. The wrapper itself lives
 * in `@/contracts/veru-pcc-vault`; this file holds only the shapes consumers see.
 */

/** Per-call options for any `VeruPccVault` transition — everything except program/function/inputs. */
export type VeruPccVaultCallOptions = Omit<
  AleoExecuteOptions,
  'programName' | 'functionName' | 'inputs'
>;

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
