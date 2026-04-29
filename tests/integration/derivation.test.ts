import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { DEFAULT_DOMAIN_SEPARATOR } from '@/constants/derivation';
import { deriveAleoAccount } from '@/derivation/deriveAleoAccount';
import { EvmSigner } from '@/derivation/signers/evm';
import { SolanaSigner } from '@/derivation/signers/solana';
import { SuiSigner } from '@/derivation/signers/sui';
import type { AleoAccountFactory } from '@/types/derivation';
import { ValidationError } from '@/utils/errors';

import {
  EVM_TEST_PRIVATE_KEY,
  SOLANA_TEST_SECRET_KEY_B64,
  SUI_TEST_SEED,
} from '../fixtures/derivation-vectors';

/**
 * Test factory: encodes the seed back into the produced keys so we can assert
 * which seed was used without depending on `@provablehq/sdk`.
 */
const stubFactory: AleoAccountFactory = {
  fromSeed: (seed) => ({
    privateKey: `APrivateKey1${Buffer.from(seed).toString('hex')}`,
    viewKey: `AViewKey1${Buffer.from(seed).toString('hex')}`,
    address: `aleo1${Buffer.from(seed).toString('hex')}`,
  }),
};

const secretKey = Uint8Array.from(Buffer.from(SOLANA_TEST_SECRET_KEY_B64, 'base64'));

describe('deriveAleoAccount — full round trip', () => {
  it('produces the same Aleo account for the same source key + message (EVM)', async () => {
    console.log(EVM_TEST_PRIVATE_KEY);
    
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    console.log(signer);
    
    const a = await deriveAleoAccount({ signer, message: 'hello', accountFactory: stubFactory });
    const b = await deriveAleoAccount({ signer, message: 'hello', accountFactory: stubFactory });
    console.log('Derived Aleo address:', a);
    
    expect(a.aleo.address).toBe(b.aleo.address);
    expect(Buffer.from(a.derivation.seed).toString('hex')).toBe(
      Buffer.from(b.derivation.seed).toString('hex'),
    );
  });

  it('produces the same account for Solana and Sui across runs', async () => {
    const sol = new SolanaSigner({ secretKey });
    const sui = new SuiSigner({ seed: SUI_TEST_SEED });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: sol, message: 'hi', accountFactory: stubFactory }),
      deriveAleoAccount({ signer: sol, message: 'hi', accountFactory: stubFactory }),
    ]);
    const [c, d] = await Promise.all([
      deriveAleoAccount({ signer: sui, message: 'hi', accountFactory: stubFactory }),
      deriveAleoAccount({ signer: sui, message: 'hi', accountFactory: stubFactory }),
    ]);
    expect(a.aleo.address).toBe(b.aleo.address);
    expect(c.aleo.address).toBe(d.aleo.address);
    expect(a.aleo.address).not.toBe(c.aleo.address);
  });

  it('different messages produce different Aleo accounts', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const a = await deriveAleoAccount({ signer, message: 'one', accountFactory: stubFactory });
    const b = await deriveAleoAccount({ signer, message: 'two', accountFactory: stubFactory });
    expect(a.aleo.address).not.toBe(b.aleo.address);
  });

  it('different domain separators produce different Aleo accounts', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const base = await deriveAleoAccount({
      signer,
      message: 'hi',
      accountFactory: stubFactory,
    });
    const alt = await deriveAleoAccount({
      signer,
      message: 'hi',
      accountFactory: stubFactory,
      domainSeparator: 'OTHER|domain|v1',
    });
    expect(base.aleo.address).not.toBe(alt.aleo.address);
  });

  it('reports source/derivation/aleo metadata in the result', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const result = await deriveAleoAccount({
      signer,
      message: 'hi',
      accountFactory: stubFactory,
    });

    expect(result.source.chain).toBe('evm');
    expect(result.source.message).toBe('hi');
    expect(result.source.signerId.toLowerCase().startsWith('0x')).toBe(true);

    expect(result.derivation.domainSeparator).toBe(DEFAULT_DOMAIN_SEPARATOR);
    expect(result.derivation.hkdfInfoUtf8).toBe('sodax/aleo-keygen/v1');
    expect(result.derivation.saltSha256DomainHex).toMatch(/^[0-9a-f]{64}$/);
    expect(result.derivation.seed.length).toBe(32);

    expect(result.aleo.network).toBe('testnet');
    expect(result.aleo.address.startsWith('aleo1')).toBe(true);
  });

  it('passes the derived seed to the account factory', async () => {
    let observed: Uint8Array | undefined;
    const spy: AleoAccountFactory = {
      fromSeed: (seed) => {
        observed = seed;
        return { privateKey: 'pk', viewKey: 'vk', address: 'aleo1xyz' };
      },
    };
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const r = await deriveAleoAccount({ signer, message: 'hi', accountFactory: spy });
    expect(observed).toBeDefined();
    expect(observed?.length).toBe(32);
    expect(Buffer.from(observed!).toString('hex')).toBe(
      Buffer.from(r.derivation.seed).toString('hex'),
    );
  });

  describe('validation', () => {
    it('rejects missing message', async () => {
      const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
      await expect(
        deriveAleoAccount({ signer, message: '', accountFactory: stubFactory }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects missing signer', async () => {
      await expect(
        deriveAleoAccount({
          signer: undefined as never,
          message: 'hi',
          accountFactory: stubFactory,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
