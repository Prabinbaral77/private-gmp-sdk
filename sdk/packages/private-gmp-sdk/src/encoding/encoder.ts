import { EncodingError } from '../utils/errors';
import { isAleoAddress } from '../utils/validation';

import type {
  AleoAddress,
  AleoBoolean,
  AleoField,
  AleoIntegerType,
  AleoPrimitiveType,
  AleoValue,
} from '../types/aleo';

const UNSIGNED_BOUNDS: Record<string, bigint> = {
  u8: 2n ** 8n - 1n,
  u16: 2n ** 16n - 1n,
  u32: 2n ** 32n - 1n,
  u64: 2n ** 64n - 1n,
  u128: 2n ** 128n - 1n,
};

const SIGNED_BOUNDS: Record<string, { min: bigint; max: bigint }> = {
  i8: { min: -(2n ** 7n), max: 2n ** 7n - 1n },
  i16: { min: -(2n ** 15n), max: 2n ** 15n - 1n },
  i32: { min: -(2n ** 31n), max: 2n ** 31n - 1n },
  i64: { min: -(2n ** 63n), max: 2n ** 63n - 1n },
  i128: { min: -(2n ** 127n), max: 2n ** 127n - 1n },
};

const INTEGER_TYPES: readonly AleoIntegerType[] = [
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'i8',
  'i16',
  'i32',
  'i64',
  'i128',
];

function isIntegerType(type: AleoPrimitiveType): type is AleoIntegerType {
  return (INTEGER_TYPES as readonly string[]).includes(type);
}

function toBigInt(value: number | bigint | string, type: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new EncodingError(`Cannot encode non-integer ${value} as ${type}.`);
    }
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const stripped = value.replace(new RegExp(`${type}$`), '').trim();
    if (!/^-?\d+$/.test(stripped)) {
      throw new EncodingError(`Cannot parse "${value}" as ${type}.`);
    }
    return BigInt(stripped);
  }
  throw new EncodingError(`Unsupported integer source ${typeof value} for ${type}.`);
}

export function encodeUnsigned(
  value: number | bigint | string,
  type: 'u8' | 'u16' | 'u32' | 'u64' | 'u128',
): string {
  const n = toBigInt(value, type);
  if (n < 0n) {
    throw new EncodingError(`${type} must be non-negative, got ${n}.`);
  }
  const max = UNSIGNED_BOUNDS[type];
  if (max === undefined) {
    throw new EncodingError(`Unknown unsigned type ${type}.`);
  }
  if (n > max) {
    throw new EncodingError(`${type} overflow: ${n} > ${max}.`);
  }
  return `${n.toString()}${type}`;
}

export function encodeSigned(
  value: number | bigint | string,
  type: 'i8' | 'i16' | 'i32' | 'i64' | 'i128',
): string {
  const n = toBigInt(value, type);
  const bounds = SIGNED_BOUNDS[type];
  if (bounds === undefined) {
    throw new EncodingError(`Unknown signed type ${type}.`);
  }
  if (n < bounds.min || n > bounds.max) {
    throw new EncodingError(`${type} out of range: ${n} not in [${bounds.min}, ${bounds.max}].`);
  }
  return `${n.toString()}${type}`;
}

export function encodeField(value: number | bigint | string): AleoField {
  const n = toBigInt(value, 'field');
  if (n < 0n) {
    throw new EncodingError(`field must be non-negative, got ${n}.`);
  }
  return `${n.toString()}field` as AleoField;
}

export function encodeScalar(value: number | bigint | string): string {
  const n = toBigInt(value, 'scalar');
  if (n < 0n) {
    throw new EncodingError(`scalar must be non-negative, got ${n}.`);
  }
  return `${n.toString()}scalar`;
}

export function encodeBool(value: boolean | string): AleoBoolean {
  if (typeof value === 'boolean') {
    return (value ? 'true' : 'false') as AleoBoolean;
  }
  if (value === 'true' || value === 'false') {
    return value as AleoBoolean;
  }
  throw new EncodingError(`Cannot encode "${value}" as bool.`);
}

export function encodeAddress(value: string): AleoAddress {
  if (!isAleoAddress(value)) {
    throw new EncodingError(`Invalid Aleo address: ${value}.`);
  }
  return value as AleoAddress;
}

/** Wraps an already-typed string ("42u64", "1field", ...) without re-encoding. */
export function passthrough(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new EncodingError(`passthrough() requires a non-empty string.`);
  }
  return value;
}

/**
 * Encode a value against a declared Aleo primitive type.
 *
 * `type` follows the Leo/Aleo notation (`u64`, `field`, `bool`, ...).
 */
export function encodePrimitive(value: unknown, type: AleoPrimitiveType): AleoValue {
  if (isIntegerType(type)) {
    if (
      typeof value !== 'number' &&
      typeof value !== 'bigint' &&
      typeof value !== 'string'
    ) {
      throw new EncodingError(`Cannot encode ${typeof value} as ${type}.`);
    }
    if (type.startsWith('u')) {
      return encodeUnsigned(value, type as 'u8' | 'u16' | 'u32' | 'u64' | 'u128') as AleoValue;
    }
    return encodeSigned(value, type as 'i8' | 'i16' | 'i32' | 'i64' | 'i128') as AleoValue;
  }
  switch (type) {
    case 'field':
      return encodeField(value as number | bigint | string);
    case 'scalar':
      return encodeScalar(value as number | bigint | string) as AleoValue;
    case 'bool':
      return encodeBool(value as boolean | string);
    case 'address':
      return encodeAddress(value as string);
    case 'group':
    case 'signature':
      return passthrough(value as string) as AleoValue;
    default: {
      const exhaustive: never = type;
      throw new EncodingError(`Unsupported Aleo primitive type: ${String(exhaustive)}.`);
    }
  }
}

/**
 * Encode a struct value into the Aleo `{ key: value, ... }` literal form.
 *
 * `schema` maps field names to their primitive type so each member can be
 * type-checked the same way scalars are.
 */
export function encodeStruct(
  value: Record<string, unknown>,
  schema: Record<string, AleoPrimitiveType>,
): string {
  const parts: string[] = [];
  for (const [field, type] of Object.entries(schema)) {
    if (!(field in value)) {
      throw new EncodingError(`Missing struct field "${field}".`);
    }
    parts.push(`${field}: ${String(encodePrimitive(value[field], type))}`);
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * Best-effort runtime inference for callers that cannot or do not want to
 * supply an explicit type. Uses sensible defaults: numbers → u64,
 * bigints → u128, booleans → bool, strings starting with `aleo1` → address.
 *
 * Prefer {@link encodePrimitive} when the program ABI is known.
 */
export function encodeAuto(value: unknown): AleoValue {
  if (typeof value === 'boolean') {
    return encodeBool(value);
  }
  if (typeof value === 'number') {
    return encodePrimitive(value, 'u64');
  }
  if (typeof value === 'bigint') {
    return encodePrimitive(value, 'u128');
  }
  if (typeof value === 'string') {
    if (isAleoAddress(value)) {
      return encodeAddress(value);
    }
    return passthrough(value) as AleoValue;
  }
  throw new EncodingError(`encodeAuto cannot infer Aleo type for ${typeof value}.`);
}
