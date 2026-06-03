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

// The Aleo literal bounds used by claim/withdraw are generic; their canonical
// home is `@/constants/aleo-literals`. Re-exported here for backward compat.
export { BYTES32_LENGTH, U128_MAX, U16_MAX, U64_MAX, U8_MAX } from './aleo-literals';
