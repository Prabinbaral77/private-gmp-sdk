import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOMAIN_SEPARATOR,
  DEFAULT_HKDF_INFO_UTF8,
  SOURCE_CHAINS,
} from '@/constants/derivation';
import { assertSourceChain, deriveAleoSeed, domainSalt, isSourceChain } from '@/derivation/seed';
import { ValidationError } from '@/utils/errors';

import { DOMAIN_SALT_HEX_DEFAULT, SEED_VECTORS } from '../fixtures/derivation-vectors';

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

describe('deriveAleoSeed', () => {
  it('matches the documented domain-salt hex for the default separator', () => {
    expect(toHex(domainSalt(DEFAULT_DOMAIN_SEPARATOR))).toBe(DOMAIN_SALT_HEX_DEFAULT);
  });

  it.each(SEED_VECTORS)('golden vector: $name', ({ chain, signerId, signatureBytes, message, expectedHex }) => {
    const seed = deriveAleoSeed({ chain, signerId, signatureBytes, message });
    expect(seed.length).toBe(32);
    expect(toHex(seed)).toBe(expectedHex);
  });

  it('is deterministic — repeated calls return byte-identical seeds', () => {
    const args = {
      chain: 'evm' as const,
      signerId: '0xabc',
      signatureBytes: new Uint8Array([1, 2, 3]),
      message: 'hi',
    };
    const a = deriveAleoSeed(args);
    const b = deriveAleoSeed(args);
    expect(toHex(a)).toBe(toHex(b));
  });

  it('lowercases signerId before mixing — case differences do not change the seed', () => {
    const lower = deriveAleoSeed({
      chain: 'evm',
      signerId: '0xabcdef',
      signatureBytes: new Uint8Array([9]),
      message: 'm',
    });
    const upper = deriveAleoSeed({
      chain: 'evm',
      signerId: '0xABCDEF',
      signatureBytes: new Uint8Array([9]),
      message: 'm',
    });
    expect(toHex(lower)).toBe(toHex(upper));
  });

  it('produces different seeds when any input differs', () => {
    const base = {
      chain: 'solana' as const,
      signerId: 'pk',
      signatureBytes: new Uint8Array([0xaa]),
      message: 'm',
    };
    const baseSeed = toHex(deriveAleoSeed(base));

    expect(toHex(deriveAleoSeed({ ...base, chain: 'sui' }))).not.toBe(baseSeed);
    expect(toHex(deriveAleoSeed({ ...base, signerId: 'pk2' }))).not.toBe(baseSeed);
    expect(toHex(deriveAleoSeed({ ...base, signatureBytes: new Uint8Array([0xab]) }))).not.toBe(baseSeed);
    expect(toHex(deriveAleoSeed({ ...base, message: 'm2' }))).not.toBe(baseSeed);
  });

  it('changes the seed when the domain separator changes', () => {
    const args = {
      chain: 'evm' as const,
      signerId: '0xabc',
      signatureBytes: new Uint8Array([1]),
      message: 'm',
    };
    const a = toHex(deriveAleoSeed(args));
    const b = toHex(deriveAleoSeed({ ...args, domainSeparator: 'OTHER|domain' }));
    expect(a).not.toBe(b);
  });

  it('changes the seed when the HKDF info changes', () => {
    const args = {
      chain: 'evm' as const,
      signerId: '0xabc',
      signatureBytes: new Uint8Array([1]),
      message: 'm',
    };
    const a = toHex(deriveAleoSeed(args));
    const b = toHex(deriveAleoSeed({ ...args, hkdfInfoUtf8: 'other/info' }));
    expect(a).not.toBe(b);
  });

  it('uses the documented default HKDF info', () => {
    expect(DEFAULT_HKDF_INFO_UTF8).toBe('sodax/aleo-keygen/v1');
  });

  describe('validation', () => {
    const ok = {
      chain: 'evm' as const,
      signerId: '0xabc',
      signatureBytes: new Uint8Array([1]),
      message: 'm',
    };

    it('rejects unknown chains', () => {
      expect(() => deriveAleoSeed({ ...ok, chain: 'cosmos' as never })).toThrow(ValidationError);
    });

    it('rejects empty signerId', () => {
      expect(() => deriveAleoSeed({ ...ok, signerId: '' })).toThrow(ValidationError);
    });

    it('rejects empty signature bytes', () => {
      expect(() => deriveAleoSeed({ ...ok, signatureBytes: new Uint8Array() })).toThrow(
        ValidationError,
      );
    });

    it('rejects non-Uint8Array signature bytes', () => {
      expect(() => deriveAleoSeed({ ...ok, signatureBytes: [1, 2, 3] as never })).toThrow(
        ValidationError,
      );
    });

    it('rejects non-string message', () => {
      expect(() => deriveAleoSeed({ ...ok, message: 123 as never })).toThrow(ValidationError);
    });
  });
});

describe('source-chain helpers', () => {
  it('SOURCE_CHAINS exposes all four chains', () => {
    expect(new Set(SOURCE_CHAINS)).toEqual(new Set(['solana', 'sui', 'aleo', 'evm']));
  });

  it('isSourceChain narrows the type at runtime', () => {
    expect(isSourceChain('solana')).toBe(true);
    expect(isSourceChain('cosmos')).toBe(false);
    expect(isSourceChain(123)).toBe(false);
  });

  it('assertSourceChain throws on invalid values', () => {
    expect(() => assertSourceChain('cosmos')).toThrow(ValidationError);
    expect(() => assertSourceChain('aleo')).not.toThrow();
  });
});
