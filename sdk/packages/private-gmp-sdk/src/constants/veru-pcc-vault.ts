/**
 * Hardcoded identifiers for the `veru_pcc_vault.aleo` contract. The SDK only
 * wraps the user-facing transitions: `claim` (post-fill payout against an
 * inbound commitment) and `withdraw` (outbound intent that burns a token
 * record, charges a fee, and emits a GMP message).
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

/** Inclusive max for an Aleo u8 literal (2^8 - 1). */
export const U8_MAX = 0xffn;
/** Inclusive max for an Aleo u16 literal (2^16 - 1). */
export const U16_MAX = 0xffffn;
/** Inclusive max for an Aleo u64 literal (2^64 - 1). */
export const U64_MAX = (1n << 64n) - 1n;
/** Inclusive max for an Aleo u128 literal (2^128 - 1). */
export const U128_MAX = (1n << 128n) - 1n;

/** Required length for the `[u8; 32]` byte arrays accepted by claim/withdraw. */
export const BYTES32_LENGTH = 32;
