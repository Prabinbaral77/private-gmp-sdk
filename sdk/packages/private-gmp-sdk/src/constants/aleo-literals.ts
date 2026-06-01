/**
 * Generic Aleo literal bounds, independent of any single program. Shared by the
 * literal encoders in `@/utils/aleo-literals` and by contract input builders.
 */

/** Inclusive max for an Aleo u8 literal (2^8 - 1). */
export const U8_MAX = 0xffn;
/** Inclusive max for an Aleo u16 literal (2^16 - 1). */
export const U16_MAX = 0xffffn;
/** Inclusive max for an Aleo u64 literal (2^64 - 1). */
export const U64_MAX = (1n << 64n) - 1n;
/** Inclusive max for an Aleo u128 literal (2^128 - 1). */
export const U128_MAX = (1n << 128n) - 1n;

/** Required length for an Aleo `[u8; 32]` byte array. */
export const BYTES32_LENGTH = 32;

/** Bit widths supported by the unsigned-integer encoder. */
export type UintBits = 8 | 16 | 32 | 64 | 128;
