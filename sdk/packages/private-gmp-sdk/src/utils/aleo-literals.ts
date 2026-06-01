import { BYTES32_LENGTH, U8_MAX, type UintBits } from '@/constants/aleo-literals';
import type { Bytes32Like, FieldLike, Uint } from '@/types/aleo-literals';
import { ValidationError } from '@/utils/errors';

/**
 * Encoders that turn JS values into the textual Aleo literals an `execute` call
 * expects (e.g. `42u128`, `7field`, `[0u8, 1u8, …]`). Each validates that the
 * input fits its Aleo type and throws a {@link ValidationError} otherwise, so a
 * malformed input is rejected before it ever reaches the network.
 */

/** Encode an unsigned integer as a `<value>u<bits>` literal, bounds-checked against `max`. */
export function formatUnsigned(value: Uint, paramName: string, bits: UintBits, max: bigint): string {
  const n = toBigInt(value, paramName);
  if (n < 0n || n > max) {
    throw new ValidationError(
      `${paramName} must be in [0, ${max.toString()}] (u${bits}), received ${n.toString()}.`,
    );
  }
  return `${n.toString()}u${bits}`;
}

/** Encode a non-negative integer as a `<value>field` literal. Existing `"…field"` strings pass through. */
export function formatField(value: FieldLike, paramName: string): string {
  if (typeof value === 'string') {
    // Accept a literal like "123field" or a bare numeric string.
    const numeric = value.endsWith('field') ? value.slice(0, -'field'.length) : value;
    assertNonNegativeIntegerString(numeric, paramName);
    return `${numeric}field`;
  }
  const n = toBigInt(value, paramName);
  if (n < 0n) {
    throw new ValidationError(`${paramName} must be a non-negative field, received ${n.toString()}.`);
  }
  return `${n.toString()}field`;
}

/** Encode 32 bytes as an Aleo `[u8; 32]` literal from a hex string, byte array, or `Uint8Array`. */
export function formatBytes32(value: Bytes32Like, paramName: string): string {
  const bytes = typeof value === 'string' ? hexToBytes32(value, paramName) : toByteArray(value, paramName);
  return formatByteArrayLiteral(bytes);
}

/** Assert a value is an Aleo address (`aleo1…`) and return it unchanged. */
export function assertAddress(value: string, paramName: string): string {
  if (typeof value !== 'string' || !value.startsWith('aleo1')) {
    throw new ValidationError(`${paramName} must be an Aleo address (aleo1…), received ${String(value)}.`);
  }
  return value;
}

/** Coerce a `bigint | number | string` to a `bigint`, rejecting non-integers. */
export function toBigInt(value: Uint, paramName: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
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

/* -------------------------------- internals ------------------------------- */

/** Parse a 32-byte hex string (with or without `0x`) into bytes. */
function hexToBytes32(value: string, paramName: string): Uint8Array {
  const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== BYTES32_LENGTH * 2) {
    throw new ValidationError(`${paramName} must be a ${BYTES32_LENGTH}-byte hex string.`);
  }
  const bytes = new Uint8Array(BYTES32_LENGTH);
  for (let i = 0; i < BYTES32_LENGTH; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Validate a byte array/`Uint8Array` is exactly 32 u8 values. */
function toByteArray(value: Uint8Array | readonly number[], paramName: string): Uint8Array {
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
  return arr;
}

/** Render a byte array as an Aleo `[<n>u8, …]` literal. */
function formatByteArrayLiteral(bytes: Uint8Array): string {
  const parts = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    parts[i] = `${bytes[i] as number}u8`;
  }
  return `[${parts.join(', ')}]`;
}

/** Assert a string is a bare non-negative integer (digits only). */
function assertNonNegativeIntegerString(value: string, paramName: string): void {
  if (!/^[0-9]+$/.test(value)) {
    throw new ValidationError(`${paramName} must be a non-negative integer string, received '${value}'.`);
  }
}
