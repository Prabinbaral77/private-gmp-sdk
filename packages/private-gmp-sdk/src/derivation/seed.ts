import { createHash, hkdfSync } from 'node:crypto';

import {
  ALEO_SEED_LENGTH,
  DEFAULT_DOMAIN_SEPARATOR,
  DEFAULT_HKDF_INFO_UTF8,
  SOURCE_CHAINS,
} from '../constants/derivation';
import { ValidationError } from '../utils/errors';

import type { DeriveAleoSeedInput, SourceChain } from '../types/derivation';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function isSourceChain(value: unknown): value is SourceChain {
  return typeof value === 'string' && (SOURCE_CHAINS as readonly string[]).includes(value);
}

export function assertSourceChain(value: unknown): asserts value is SourceChain {
  if (!isSourceChain(value)) {
    throw new ValidationError(
      `Invalid source chain '${String(value)}'. Expected one of ${SOURCE_CHAINS.join(', ')}.`,
    );
  }
}

export function domainSalt(domainSeparator: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(utf8(domainSeparator)).digest());
}

/**
 * Derive a 32-byte seed for an Aleo account from a foreign-chain signature.
 *
 * Pure: no network, no chain libraries, no env reads. Same inputs always
 * produce the same output, which is what makes it safe to pin with golden
 * vectors. See {@link DEFAULT_DOMAIN_SEPARATOR} / {@link DEFAULT_HKDF_INFO_UTF8}
 * for the version constants — bumping either is a breaking change.
 */
export function deriveAleoSeed(input: DeriveAleoSeedInput): Uint8Array {
  assertSourceChain(input.chain);
  if (typeof input.signerId !== 'string' || input.signerId.length === 0) {
    throw new ValidationError('signerId must be a non-empty string.');
  }
  if (!(input.signatureBytes instanceof Uint8Array) || input.signatureBytes.length === 0) {
    throw new ValidationError('signatureBytes must be a non-empty Uint8Array.');
  }
  if (typeof input.message !== 'string') {
    throw new ValidationError('message must be a string.');
  }

  const domain = input.domainSeparator ?? DEFAULT_DOMAIN_SEPARATOR;
  const info = input.hkdfInfoUtf8 ?? DEFAULT_HKDF_INFO_UTF8;
  const salt = domainSalt(domain);
  const msgHash = createHash('sha256').update(utf8(input.message)).digest();
  const ikm = createHash('sha256')
    .update(utf8(input.chain))
    .update(utf8(input.signerId.toLowerCase()))
    .update(input.signatureBytes)
    .update(msgHash)
    .digest();

  return new Uint8Array(hkdfSync('sha256', ikm, salt, utf8(info), ALEO_SEED_LENGTH));
}
