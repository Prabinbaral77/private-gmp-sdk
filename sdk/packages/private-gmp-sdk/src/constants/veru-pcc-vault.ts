/**
 * Hardcoded identifiers for the `veru_pcc_vault.aleo` contract. The SDK only
 * wraps the user-facing transitions: `claim` (post-fill payout against an
 * inbound commitment), `withdraw` (outbound intent that burns a token
 * record, charges a fee, and emits a GMP message), and `refund` (reclaim an
 * outbound intent's funds by `source_token_id` / `source_amount` / `nonce`).
 *
 * Imports referenced by the on-chain program (so callers can audit the deploy
 * surface):
 * - `gmp_asset_manager_core_v01.aleo`
 * - `gmp_connection_v01.aleo`
 * - `gmp_lib_v01.aleo`
 * - `token_registry.aleo`
 */

export const VERU_PCC_VAULT_PROGRAM_NAME = 'veru_pcc_vault.aleo';
export const VERU_PCC_VAULT_CLAIM_FUNCTION = 'claim';
export const VERU_PCC_VAULT_WITHDRAW_FUNCTION = 'withdraw';
export const VERU_PCC_VAULT_REFUND_FUNCTION = 'refund';

/**
 * The `commitments` mapping: `[u8; 32] => CommitmentData`. The on-chain
 * `claim` reads it and asserts `status == false` before paying out, then flips
 * the entry to `status: true`. The SDK reads the same mapping pre-flight (see
 * the `claim` wrapper) so an already-claimed commitment fails fast with a clear
 * error instead of an opaque finalize reject.
 *
 * ```leo
 * struct CommitmentData:
 *     token as field;
 *     amount as u128;
 *     status as boolean;
 * ```
 */
export const VERU_PCC_VAULT_COMMITMENTS_MAPPING = 'commitments';

/**
 * The `withdraw_commitment` mapping: `[u8; 32] => Withdraw`. The on-chain
 * `withdraw` writes a fresh entry here keyed by the intent's commitment hash:
 *
 * ```leo
 * struct Withdraw:
 *     token as field;
 *     amount as u128;       // net amount sent
 *     intent_status as u8;  // TAG_INTENT_PENDING on a fresh withdraw
 *     nonce as field;
 * ```
 *
 * An entry only exists once an intent has been registered, so the SDK reads
 * this mapping pre-flight (see the `withdraw` wrapper): a non-null entry means
 * the commitment is already in flight and the withdraw must be rejected; a null
 * entry means the slot is free and the withdraw can proceed.
 */
export const VERU_PCC_VAULT_WITHDRAW_COMMITMENT_MAPPING = 'withdraw_commitment';

/**
 * `Withdraw.intent_status` tag values (`u8`) used by `veru_pcc_vault.aleo` to
 * track an outbound intent's lifecycle:
 *
 * ```leo
 * const TAG_INTENT_PENDING:   u8 = 0u8;
 * const TAG_INTENT_COMPLETED: u8 = 1u8;
 * const TAG_INTENT_FAILED:    u8 = 2u8;
 * const TAG_INTENT_REFUNDED:  u8 = 3u8;
 * ```
 *
 * The SDK reads these from the `withdraw_commitment` mapping during pre-flight
 * checks — `refund` only proceeds when the entry is `FAILED` (the intent's GMP
 * message came back unsuccessful, so the funds are reclaimable).
 */
export const VERU_PCC_VAULT_INTENT_STATUS = {
  PENDING: 0,
  COMPLETED: 1,
  FAILED: 2,
  REFUNDED: 3,
} as const;

// The Aleo literal bounds used by claim/withdraw are generic; their canonical
// home is `@/constants/aleo-literals`. Re-exported here for backward compat.
export { BYTES32_LENGTH, U128_MAX, U16_MAX, U64_MAX, U8_MAX } from './aleo-literals';
