import { ValidationError } from './errors';

import type { ProgramId } from '../types/program';

const PROGRAM_ID_REGEX = /^[a-z][a-z0-9_]*\.aleo$/;
const ALEO_ADDRESS_REGEX = /^aleo1[a-z0-9]{58}$/;
const TX_ID_REGEX = /^at1[a-z0-9]{58,}$/;

export function isProgramId(value: unknown): value is ProgramId {
  return typeof value === 'string' && PROGRAM_ID_REGEX.test(value);
}

export function assertProgramId(value: unknown): asserts value is ProgramId {
  if (!isProgramId(value)) {
    throw new ValidationError(
      `Invalid Aleo program id: ${String(value)}. Expected "<name>.aleo".`,
    );
  }
}

export function isAleoAddress(value: unknown): value is string {
  return typeof value === 'string' && ALEO_ADDRESS_REGEX.test(value);
}

export function assertAleoAddress(value: unknown): asserts value is string {
  if (!isAleoAddress(value)) {
    throw new ValidationError(`Invalid Aleo address: ${String(value)}.`);
  }
}

export function isTransactionId(value: unknown): value is string {
  return typeof value === 'string' && TX_ID_REGEX.test(value);
}

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }
}

export function assertPositiveBigInt(value: unknown, field: string): asserts value is bigint {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new ValidationError(`${field} must be a non-negative bigint.`);
  }
}
