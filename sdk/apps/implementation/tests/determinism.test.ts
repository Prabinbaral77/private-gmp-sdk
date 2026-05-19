import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it, before } from 'node:test';

import { AleoAccountDeriver } from '@venture23-aleo/private-gmp-sdk';
import type { AleoNetwork, SignedMessage, SourceChain } from '@venture23-aleo/private-gmp-sdk';

import {
  AleoSigner,
  BitcoinSigner,
  EvmSigner,
  SolanaSigner,
  StacksSigner,
  StellarSigner,
  SuiSigner,
} from '../src/signers/index.js';
import { loadDotenv, requireEnv } from '../src/utils.js';

const MESSAGE = 'determinism-test: same input must yield same output';
const NETWORK: AleoNetwork = 'testnet';

type SignFn = () => Promise<SignedMessage>;

const deriver = new AleoAccountDeriver({ network: NETWORK });

async function signAndDerive(chain: SourceChain, signFn: SignFn) {
  const signed = await signFn();
  const derived = await deriver.derive({
    chain,
    signerId: signed.signerId,
    signatureBytes: signed.signatureBytes,
    signatureDisplay: signed.signatureDisplay,
    message: MESSAGE,
  });
  return { signed, derived };
}

const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

function assertSameSigned(a: SignedMessage, b: SignedMessage, chain: string): void {
  assert.equal(a.signerId, b.signerId, `${chain}: signerId differs`);
  assert.equal(a.signatureDisplay, b.signatureDisplay, `${chain}: signatureDisplay differs`);
  assert.equal(toHex(a.signatureBytes), toHex(b.signatureBytes), `${chain}: signatureBytes differ`);
}

describe('signer determinism', () => {
  before(() => {
    loadDotenv();
  });

  it('evm: same key + message → identical signature & Aleo account', async () => {
    const pk = requireEnv('EVM_PRIVATE_KEY');
    const a = await signAndDerive('evm', () => EvmSigner.fromPrivateKey(pk).sign(MESSAGE));
    const b = await signAndDerive('evm', () => EvmSigner.fromPrivateKey(pk).sign(MESSAGE));
    assertSameSigned(a.signed, b.signed, 'evm');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('solana: same key + message → identical signature & Aleo account', async () => {
    const sk = requireEnv('SOLANA_PRIVATE_KEY');
    const a = await signAndDerive('solana', () =>
      SolanaSigner.fromBase58SecretKey(sk).sign(MESSAGE),
    );
    const b = await signAndDerive('solana', () =>
      SolanaSigner.fromBase58SecretKey(sk).sign(MESSAGE),
    );
    assertSameSigned(a.signed, b.signed, 'solana');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('sui: same key + message → identical signature & Aleo account', async () => {
    const seed = requireEnv('SUI_PRIVATE_KEY');
    const a = await signAndDerive('sui', () => SuiSigner.fromHexSeed(seed).sign(MESSAGE));
    const b = await signAndDerive('sui', () => SuiSigner.fromHexSeed(seed).sign(MESSAGE));
    assertSameSigned(a.signed, b.signed, 'sui');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('bitcoin: same WIF + message → identical signature & Aleo account', async () => {
    const wif = requireEnv('BITCOIN_WIF');
    const a = await signAndDerive('bitcoin', () => BitcoinSigner.fromWif(wif).sign(MESSAGE));
    const b = await signAndDerive('bitcoin', () => BitcoinSigner.fromWif(wif).sign(MESSAGE));
    assertSameSigned(a.signed, b.signed, 'bitcoin');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('stellar: same secret + message → identical signature & Aleo account', async () => {
    const secret = requireEnv('STELLAR_SECRET_KEY');
    const a = await signAndDerive('stellar', () => StellarSigner.fromSecret(secret).sign(MESSAGE));
    const b = await signAndDerive('stellar', () => StellarSigner.fromSecret(secret).sign(MESSAGE));
    assertSameSigned(a.signed, b.signed, 'stellar');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('stacks: same key + message → identical signature & Aleo account', async () => {
    const pk = requireEnv('STACKS_PRIVATE_KEY');
    const a = await signAndDerive('stacks', () =>
      StacksSigner.fromPrivateKey(pk, 'mainnet').sign(MESSAGE),
    );
    const b = await signAndDerive('stacks', () =>
      StacksSigner.fromPrivateKey(pk, 'mainnet').sign(MESSAGE),
    );
    assertSameSigned(a.signed, b.signed, 'stacks');
    assert.equal(a.derived.aleo.address, b.derived.aleo.address);
    assert.equal(toHex(a.derived.derivation.seed), toHex(b.derived.derivation.seed));
  });

  it('aleo (random): same message → DIFFERENT signature & Aleo account', async () => {
    const a = await signAndDerive('aleo', () => AleoSigner.random(NETWORK).sign(MESSAGE));
    const b = await signAndDerive('aleo', () => AleoSigner.random(NETWORK).sign(MESSAGE));
    assert.notEqual(a.signed.signerId, b.signed.signerId, 'aleo random: signerId must differ');
    assert.notEqual(
      a.signed.signatureDisplay,
      b.signed.signatureDisplay,
      'aleo random: signatureDisplay must differ',
    );
    assert.notEqual(
      a.derived.aleo.address,
      b.derived.aleo.address,
      'aleo random: derived Aleo address must differ',
    );
  });

  it('aleo (fromPrivateKey): same key → same signerId, but DIFFERENT signature (Schnorr non-deterministic)', async () => {
    const pk = requireEnv('ALEO_SOURCE_PRIVATE_KEY');
    const a = await signAndDerive('aleo', () =>
      AleoSigner.fromPrivateKey(pk, NETWORK).sign(MESSAGE),
    );
    const b = await signAndDerive('aleo', () =>
      AleoSigner.fromPrivateKey(pk, NETWORK).sign(MESSAGE),
    );
    // The signer identity (Aleo address of the source key) is stable...
    assert.equal(a.signed.signerId, b.signed.signerId, 'aleo: signerId must match (same source key)');
    // ...but Aleo's signing uses a fresh random nonce, so signatures differ on every call,
    // which propagates to a different derived Aleo account each time.
    assert.notEqual(
      a.signed.signatureDisplay,
      b.signed.signatureDisplay,
      'aleo: signatureDisplay must differ across calls (Schnorr nonce)',
    );
    assert.notEqual(
      a.derived.aleo.address,
      b.derived.aleo.address,
      'aleo: derived Aleo address must differ across calls',
    );
  });
});
