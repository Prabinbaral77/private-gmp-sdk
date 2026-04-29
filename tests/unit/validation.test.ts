import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/utils/errors';
import {
  assertAleoAddress,
  assertProgramId,
  isAleoAddress,
  isProgramId,
  isTransactionId,
} from '@/utils/validation';

import { SAMPLE_ADDRESS } from '../fixtures/sample-data';

describe('validation / program ids', () => {
  it('accepts well-formed ids', () => {
    expect(isProgramId('credits.aleo')).toBe(true);
    expect(isProgramId('my_token.aleo')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(isProgramId('credits')).toBe(false);
    expect(isProgramId('Credits.aleo')).toBe(false);
    expect(isProgramId('1bad.aleo')).toBe(false);
  });

  it('throws on assertion failure', () => {
    expect(() => assertProgramId('bad')).toThrow(ValidationError);
  });
});

describe('validation / addresses', () => {
  it('accepts valid addresses', () => {
    expect(isAleoAddress(SAMPLE_ADDRESS)).toBe(true);
    expect(() => assertAleoAddress(SAMPLE_ADDRESS)).not.toThrow();
  });

  it('rejects invalid addresses', () => {
    expect(isAleoAddress('aleo1short')).toBe(false);
    expect(() => assertAleoAddress('nope')).toThrow(ValidationError);
  });
});

describe('validation / transaction ids', () => {
  it('matches at1<58+ chars>', () => {
    expect(isTransactionId('at1' + 'a'.repeat(58))).toBe(true);
    expect(isTransactionId('at1short')).toBe(false);
  });
});
