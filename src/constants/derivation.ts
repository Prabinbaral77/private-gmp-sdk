import type { SourceChain } from '../types/derivation';

/**
 * Constants for the cross-chain Aleo account derivation module.
 *
 * Bumping {@link DEFAULT_DOMAIN_SEPARATOR} or {@link DEFAULT_HKDF_INFO_UTF8} is
 * a breaking change — every existing user re-deriving an Aleo account from a
 * foreign signature would land on a different address. Pin them with golden
 * vectors and bump in lockstep with a major SDK release.
 */

export const SOURCE_CHAINS: readonly SourceChain[] = [
  'solana',
  'sui',
  'aleo',
  'evm',
] as const;

export const DEFAULT_DOMAIN_SEPARATOR = 'SODAX|aleo-keygen|non-evm|v1';
export const DEFAULT_HKDF_INFO_UTF8 = 'sodax/aleo-keygen/v1';

/** Aleo account seed length, in bytes. */
export const ALEO_SEED_LENGTH = 32;

/** Solana secret-key length: 32-byte seed + 32-byte pubkey concatenated. */
export const SOLANA_SECRET_KEY_LENGTH = 64;

/** Sui ed25519 seed length, in bytes. */
export const SUI_SEED_LENGTH = 32;

/** Sui scheme flag for ed25519 keys (used in address derivation). */
export const SUI_SCHEME_FLAG_ED25519 = 0x00;

/** Ed25519 public key length, in bytes. */
export const ED25519_PUBLIC_KEY_LENGTH = 32;

/** Default message used when none is provided to the CLI. */
export const DEFAULT_DERIVATION_MESSAGE = 'Sign to derive deterministic Aleo wallet';
