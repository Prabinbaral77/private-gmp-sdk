import { EncodingError } from '../utils/errors';

import type { AleoIntegerType } from '../types/aleo';

const INTEGER_SUFFIX_REGEX = /^(-?\d+)(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)$/;

export type DecodedInteger = {
  readonly value: bigint;
  readonly type: AleoIntegerType;
};

export function decodeInteger(literal: string): DecodedInteger {
  const m = INTEGER_SUFFIX_REGEX.exec(literal);
  if (!m) {
    throw new EncodingError(`Cannot decode "${literal}" as Aleo integer.`);
  }
  return { value: BigInt(m[1] as string), type: m[2] as AleoIntegerType };
}

export function decodeBool(literal: string): boolean {
  if (literal === 'true') {
    return true;
  }
  if (literal === 'false') {
    return false;
  }
  throw new EncodingError(`Cannot decode "${literal}" as bool.`);
}

export function decodeField(literal: string): bigint {
  if (!/^\d+field$/.test(literal)) {
    throw new EncodingError(`Cannot decode "${literal}" as field.`);
  }
  return BigInt(literal.slice(0, -'field'.length));
}

/** Strip the type suffix from any typed Aleo literal (`"5u64"` → `"5"`). */
export function stripSuffix(literal: string): string {
  return literal.replace(/(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|field|scalar|group)$/, '');
}
