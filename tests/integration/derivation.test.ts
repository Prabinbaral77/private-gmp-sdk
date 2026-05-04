import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOMAIN_SEPARATOR } from '@/constants/derivation';
import { deriveAleoAccount } from '@/derivation/deriveAleoAccount';
import { EvmSigner } from '@/derivation/signers/evm';
import { SolanaSigner } from '@/derivation/signers/solana';
import { SuiSigner } from '@/derivation/signers/sui';
import { ValidationError } from '@/utils/errors';

import {
  BITCOIN_PRIVATE_KEY,
  EVM_TEST_PRIVATE_KEY,
  STACKS_PRIVATE_KEY,
  SOLANA_TEST_SECRET_KEY_B64,
  SUI_PRIVATE_KEY_HEX,
  STELLAR_PRIVATE_KEY
} from '../fixtures/derivation-vectors';
import { StellarSigner } from '@/derivation/signers/stellar';
import { BitcoinSigner } from '@/derivation/signers/bitcoin';
import { StacksSigner } from '@/derivation/signers/stacks';


describe('deriveAleoAccount — full round trip', () => {
  it('produces the same Aleo account for the same source key + message (EVM)', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const a = await deriveAleoAccount({ signer, message: 'hello' });
    const b = await deriveAleoAccount({ signer, message: 'hello' });

    expect(a.aleo.address).toBe(b.aleo.address);
    expect(Buffer.from(a.derivation.seed).toString('hex')).toBe(
      Buffer.from(b.derivation.seed).toString('hex'),
    );
  });

  it('produces the same account for Solana  across runs', async () => {
    const sol = new SolanaSigner({ secretKey: SOLANA_TEST_SECRET_KEY_B64 });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: sol, message: 'hello' }),
      deriveAleoAccount({ signer: sol, message: 'hello' }),
    ]);
    expect(a.aleo.address).toBe(b.aleo.address);
  });

  it('produces the same account for Sui across runs', async () => {
    const sui = new SuiSigner({ seed: SUI_PRIVATE_KEY_HEX });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: sui, message: 'hello' }),
      deriveAleoAccount({ signer: sui, message: 'hello' }),
    ]);
    
    expect(a.aleo.address).toBe(b.aleo.address);
  });

  it('produces the same account for Stellar across runs', async () => {
    const stellar = new StellarSigner({ secret: STELLAR_PRIVATE_KEY });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: stellar, message: 'hello' }),
      deriveAleoAccount({ signer: stellar, message: 'hello' }),
    ]);
    expect(a.aleo.address).toBe(b.aleo.address);
  });

  it('produces the same account for Bitcoin across runs', async () => {
    const bitcoin = new BitcoinSigner({ wif: BITCOIN_PRIVATE_KEY });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: bitcoin, message: 'hello' }),
      deriveAleoAccount({ signer: bitcoin, message: 'hello' }),
    ]);

    expect(a.aleo.address).toBe(b.aleo.address);
    expect(a.source.chain).toBe('bitcoin');
    expect(a.source.signerId.startsWith('1')).toBe(true);
  });

  it('produces the same account for Stacks across runs', async () => {
   
    const stacks = new StacksSigner({ privateKey: STACKS_PRIVATE_KEY });
    const [a, b] = await Promise.all([
      deriveAleoAccount({ signer: stacks, message: 'hello' }),
      deriveAleoAccount({ signer: stacks, message: 'hello' }),
    ]);

    console.log('Derived Aleo address a:', a.aleo.address);
    console.log('Derived Aleo address b:', b.aleo.address);
    expect(a.aleo.address).toBe(b.aleo.address);
    expect(a.source.chain).toBe('stacks');
    expect(a.source.signerId.startsWith('SP')).toBe(true);
  });

  it('different messages produce different Aleo accounts', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const a = await deriveAleoAccount({ signer, message: 'one' });
    const b = await deriveAleoAccount({ signer, message: 'two' });
    expect(a.aleo.address).not.toBe(b.aleo.address);
  });

  it('different domain separators produce different Aleo accounts', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const base = await deriveAleoAccount({ signer, message: 'hi' });
    const alt = await deriveAleoAccount({
      signer,
      message: 'hi',
      domainSeparator: 'OTHER|domain|v1',
    });
    expect(base.aleo.address).not.toBe(alt.aleo.address);
  });

  it('reports source/derivation/aleo metadata in the result', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const result = await deriveAleoAccount({ signer, message: 'hi' });

    expect(result.source.chain).toBe('evm');
    expect(result.source.message).toBe('hi');
    expect(result.source.signerId.toLowerCase().startsWith('0x')).toBe(true);

    expect(result.derivation.domainSeparator).toBe(DEFAULT_DOMAIN_SEPARATOR);
    expect(result.derivation.hkdfInfoUtf8).toBe('verufi/aleo-keygen/v1');
    expect(result.derivation.saltSha256DomainHex).toMatch(/^[0-9a-f]{64}$/);
    expect(result.derivation.seed.length).toBe(32);

    expect(result.aleo.network).toBe('testnet');
    expect(result.aleo.address.startsWith('aleo1')).toBe(true);
  });

  describe('validation', () => {
    it('rejects missing message', async () => {
      const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
      await expect(
        deriveAleoAccount({ signer, message: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects missing signer', async () => {
      await expect(
        deriveAleoAccount({ signer: undefined as never, message: 'hi' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

