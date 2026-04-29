import { describe, expect, it } from 'vitest';

import {
  decodeBool,
  decodeField,
  decodeInteger,
  encodeAddress,
  encodeAuto,
  encodeBool,
  encodeField,
  encodePrimitive,
  encodeSigned,
  encodeStruct,
  encodeUnsigned,
} from '@/encoding';
import { EncodingError } from '@/utils/errors';

import { SAMPLE_ADDRESS } from '../fixtures/sample-data';

describe('encoder / unsigned integers', () => {
  it.each([
    [0, 'u8', '0u8'],
    [255, 'u8', '255u8'],
    [1_000n, 'u64', '1000u64'],
    ['42', 'u32', '42u32'],
  ] as const)('encodes %s as %s', (input, type, expected) => {
    expect(encodeUnsigned(input, type)).toBe(expected);
  });

  it('rejects overflow', () => {
    expect(() => encodeUnsigned(256, 'u8')).toThrow(EncodingError);
  });

  it('rejects negatives', () => {
    expect(() => encodeUnsigned(-1, 'u32')).toThrow(EncodingError);
  });

  it('rejects non-integer numbers', () => {
    expect(() => encodeUnsigned(1.5, 'u32')).toThrow(EncodingError);
  });
});

describe('encoder / signed integers', () => {
  it('encodes within bounds', () => {
    expect(encodeSigned(-128, 'i8')).toBe('-128i8');
    expect(encodeSigned(127, 'i8')).toBe('127i8');
  });

  it('rejects out-of-range values', () => {
    expect(() => encodeSigned(128, 'i8')).toThrow(EncodingError);
    expect(() => encodeSigned(-129, 'i8')).toThrow(EncodingError);
  });
});

describe('encoder / field & bool', () => {
  it('encodes field', () => {
    expect(encodeField(123)).toBe('123field');
    expect(encodeField('456')).toBe('456field');
  });

  it('rejects negative field', () => {
    expect(() => encodeField(-1)).toThrow(EncodingError);
  });

  it('encodes bool', () => {
    expect(encodeBool(true)).toBe('true');
    expect(encodeBool(false)).toBe('false');
    expect(encodeBool('true')).toBe('true');
  });

  it('rejects non-bool string', () => {
    expect(() => encodeBool('yes' as never)).toThrow(EncodingError);
  });
});

describe('encoder / address', () => {
  it('accepts a valid address', () => {
    expect(encodeAddress(SAMPLE_ADDRESS)).toBe(SAMPLE_ADDRESS);
  });

  it('rejects malformed addresses', () => {
    expect(() => encodeAddress('not-an-address')).toThrow(EncodingError);
    expect(() => encodeAddress('aleo1short')).toThrow(EncodingError);
  });
});

describe('encoder / encodePrimitive dispatch', () => {
  it('routes to integer encoders', () => {
    expect(encodePrimitive(7, 'u64')).toBe('7u64');
    expect(encodePrimitive(-3, 'i32')).toBe('-3i32');
  });

  it('routes to field/bool/address', () => {
    expect(encodePrimitive(9, 'field')).toBe('9field');
    expect(encodePrimitive(true, 'bool')).toBe('true');
    expect(encodePrimitive(SAMPLE_ADDRESS, 'address')).toBe(SAMPLE_ADDRESS);
  });
});

describe('encoder / structs', () => {
  it('encodes a struct against a schema', () => {
    const out = encodeStruct(
      { recipient: SAMPLE_ADDRESS, amount: 1000n },
      { recipient: 'address', amount: 'u64' },
    );
    expect(out).toBe(`{ recipient: ${SAMPLE_ADDRESS}, amount: 1000u64 }`);
  });

  it('throws when a field is missing', () => {
    expect(() =>
      encodeStruct({ amount: 1n } as Record<string, unknown>, {
        recipient: 'address',
        amount: 'u64',
      }),
    ).toThrow(EncodingError);
  });
});

describe('encoder / encodeAuto', () => {
  it('infers reasonable defaults', () => {
    expect(encodeAuto(10)).toBe('10u64');
    expect(encodeAuto(10n)).toBe('10u128');
    expect(encodeAuto(true)).toBe('true');
    expect(encodeAuto(SAMPLE_ADDRESS)).toBe(SAMPLE_ADDRESS);
  });

  it('refuses unsupported types', () => {
    expect(() => encodeAuto({} as unknown)).toThrow(EncodingError);
  });
});

describe('decoder', () => {
  it('decodes integers', () => {
    expect(decodeInteger('42u64')).toEqual({ value: 42n, type: 'u64' });
    expect(decodeInteger('-7i32')).toEqual({ value: -7n, type: 'i32' });
  });

  it('decodes bool', () => {
    expect(decodeBool('true')).toBe(true);
    expect(decodeBool('false')).toBe(false);
  });

  it('decodes field', () => {
    expect(decodeField('99field')).toBe(99n);
  });

  it('rejects malformed input', () => {
    expect(() => decodeInteger('42')).toThrow(EncodingError);
    expect(() => decodeBool('1')).toThrow(EncodingError);
    expect(() => decodeField('99u64')).toThrow(EncodingError);
  });
});
