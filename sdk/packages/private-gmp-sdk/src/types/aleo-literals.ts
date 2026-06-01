/**
 * JS input forms accepted for Aleo literals.
 *
 * These describe the shapes a caller may pass for each Aleo type; the encoders
 * in {@link ../utils/aleo-literals} turn them into the textual on-chain literals
 * an `execute` call expects (e.g. `42u128`, `7field`, `[0u8, …]`).
 */

/** Accepted numeric input form for any unsigned Aleo integer. */
export type Uint = bigint | number | string;

/** Accepted form for an Aleo `field` literal — already-stringified literals (`"1field"`) are passed through. */
export type FieldLike = bigint | number | string;

/** Accepted form for an Aleo `[u8; 32]` literal — hex string, byte array, or `Uint8Array`. */
export type Bytes32Like = Uint8Array | readonly number[] | string;
