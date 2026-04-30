import { Buffer } from 'node:buffer';

import { beforeAll, describe, expect, it } from 'vitest';

import { AleoSourceSigner } from '@/derivation/signers/aleo';
import { BitcoinSigner } from '@/derivation/signers/bitcoin';
import { EvmSigner } from '@/derivation/signers/evm';
import { SolanaSigner } from '@/derivation/signers/solana';
import { SuiSigner, suiAddressFromPublicKey } from '@/derivation/signers/sui';
import { ValidationError, WalletError } from '@/utils/errors';

import {
  BITCOIN_PRIVATE_KEY,
  EVM_TEST_ADDRESS,
  EVM_TEST_PRIVATE_KEY,
  EVM_TEST_SIG_HEX_FOR_TEST_MESSAGE,
  SOLANA_TEST_ADDRESS,
  SOLANA_TEST_SECRET_KEY_B64,
  SOLANA_TEST_SIG_HEX_FOR_TEST_MESSAGE,
  SUI_TEST_ADDRESS,
  SUI_TEST_PUBKEY_HEX,
  SUI_TEST_SEED,
  SUI_TEST_SEED_HEX,
  SUI_TEST_SIG_HEX_FOR_TEST_MESSAGE,
  TEST_MESSAGE,
} from '../fixtures/derivation-vectors';

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

describe('SuiSigner', () => {
  it('reports chain="sui"', () => {
    expect(new SuiSigner({ seed: SUI_TEST_SEED_HEX }).chain).toBe('sui');
  });

  it('rejects malformed or wrong-length seeds', () => {
    expect(() => new SuiSigner({ seed: '42'.repeat(31) })).toThrow(ValidationError);
    expect(() => new SuiSigner({ seed: '42'.repeat(33) })).toThrow(ValidationError);
    expect(() => new SuiSigner({ seed: 'nothex_'.repeat(8) })).toThrow(ValidationError);
    expect(() => new SuiSigner({ seed: '' })).toThrow(ValidationError);
    expect(() => new SuiSigner({ seed: new Uint8Array(32) as never })).toThrow(ValidationError);
  });

  it('accepts a 0x-prefixed seed', () => {
    expect(new SuiSigner({ seed: `0x${SUI_TEST_SEED_HEX}` }).chain).toBe('sui');
  });

  it('derives the documented Sui address from a known seed', async () => {
    const signer = new SuiSigner({ seed: SUI_TEST_SEED_HEX });
    const signed = await signer.sign(TEST_MESSAGE);
    expect(signed.signerId).toBe(SUI_TEST_ADDRESS);
  });

  it('produces deterministic ed25519 signatures', async () => {
    const signer = new SuiSigner({ seed: SUI_TEST_SEED_HEX });
    const signed = await signer.sign(TEST_MESSAGE);
    expect(toHex(signed.signatureBytes)).toBe(SUI_TEST_SIG_HEX_FOR_TEST_MESSAGE);
    expect(signed.signatureDisplay).toBe(Buffer.from(signed.signatureBytes).toString('base64'));
  });

  it('fromHexSeed and fromBase64Seed agree with the constructor', async () => {
    const b64 = Buffer.from(SUI_TEST_SEED).toString('base64');
    const a = await new SuiSigner({ seed: SUI_TEST_SEED_HEX }).sign(TEST_MESSAGE);
    const b = await SuiSigner.fromHexSeed(SUI_TEST_SEED_HEX).sign(TEST_MESSAGE);
    const c = await SuiSigner.fromBase64Seed(b64).sign(TEST_MESSAGE);
    expect(b.signerId).toBe(a.signerId);
    expect(c.signerId).toBe(a.signerId);
    expect(toHex(b.signatureBytes)).toBe(toHex(a.signatureBytes));
    expect(toHex(c.signatureBytes)).toBe(toHex(a.signatureBytes));
  });

  it('suiAddressFromPublicKey matches the known value', () => {
    expect(suiAddressFromPublicKey(Uint8Array.from(Buffer.from(SUI_TEST_PUBKEY_HEX, 'hex')))).toBe(
      SUI_TEST_ADDRESS,
    );
  });

  it('suiAddressFromPublicKey rejects bad lengths', () => {
    expect(() => suiAddressFromPublicKey(new Uint8Array(31))).toThrow(ValidationError);
    expect(() => suiAddressFromPublicKey('hex' as never)).toThrow(ValidationError);
  });
});

describe('SolanaSigner', () => {
  const secretKeyBytes = Uint8Array.from(Buffer.from(SOLANA_TEST_SECRET_KEY_B64, 'base64'));
  let secretKey: string;

  beforeAll(async () => {
    const { default: bs58 } = await import('bs58');
    secretKey = bs58.encode(secretKeyBytes);
  });

  it('reports chain="solana"', () => {
    expect(new SolanaSigner({ secretKey }).chain).toBe('solana');
  });

  it('rejects non-string secret keys', () => {
    expect(() => new SolanaSigner({ secretKey: new Uint8Array(63) as never })).toThrow(
      ValidationError,
    );
    expect(() => new SolanaSigner({ secretKey: '' })).toThrow(ValidationError);
  });

  it('rejects secret keys that do not decode to 64 bytes', async () => {
    const { default: bs58 } = await import('bs58');
    const tooShort = bs58.encode(new Uint8Array(63));
    await expect(new SolanaSigner({ secretKey: tooShort }).sign(TEST_MESSAGE)).rejects.toThrow(
      ValidationError,
    );
  });

  it('derives the documented Solana address from a known secret key', async () => {
    const signer = new SolanaSigner({ secretKey });
    const signed = await signer.sign(TEST_MESSAGE);
    expect(signed.signerId).toBe(SOLANA_TEST_ADDRESS);
  });

  it('produces deterministic ed25519 signatures', async () => {
    const signer = new SolanaSigner({ secretKey });
    const signed = await signer.sign(TEST_MESSAGE);
    expect(toHex(signed.signatureBytes)).toBe(SOLANA_TEST_SIG_HEX_FOR_TEST_MESSAGE);
    expect(typeof signed.signatureDisplay).toBe('string');
  });

  it('fromJsonSecretKey matches the constructor', async () => {
    const jsonArray = Array.from(secretKeyBytes);
    const a = await new SolanaSigner({ secretKey }).sign(TEST_MESSAGE);
    const b = await (await SolanaSigner.fromJsonSecretKey(jsonArray)).sign(TEST_MESSAGE);
    expect(b.signerId).toBe(a.signerId);
    expect(toHex(b.signatureBytes)).toBe(toHex(a.signatureBytes));
  });

  it('fromBase58SecretKey matches the constructor', async () => {
    const a = await new SolanaSigner({ secretKey }).sign(TEST_MESSAGE);
    const b = await SolanaSigner.fromBase58SecretKey(secretKey).sign(TEST_MESSAGE);
    expect(b.signerId).toBe(a.signerId);
  });
});

describe('EvmSigner', () => {
  it('reports chain="evm"', () => {
    expect(new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY }).chain).toBe('evm');
  });

  it('rejects empty private keys', () => {
    expect(() => new EvmSigner({ privateKey: '' })).toThrow(ValidationError);
    expect(() => new EvmSigner({ privateKey: 123 as never })).toThrow(ValidationError);
  });

  it('signs deterministically (RFC 6979) and reports the right address', async () => {
    const signer = new EvmSigner({ privateKey: EVM_TEST_PRIVATE_KEY });
    const signed = await signer.sign(TEST_MESSAGE);
    expect(signed.signerId).toBe(EVM_TEST_ADDRESS);
    expect(signed.signatureDisplay).toBe(EVM_TEST_SIG_HEX_FOR_TEST_MESSAGE);
    expect(`0x${toHex(signed.signatureBytes)}`).toBe(EVM_TEST_SIG_HEX_FOR_TEST_MESSAGE.toLowerCase());
  });
});

describe('BitcoinSigner', () => {
  it('reports chain="bitcoin"', () => {
    expect(new BitcoinSigner({ wif: BITCOIN_PRIVATE_KEY }).chain).toBe('bitcoin');
  });

  it('rejects empty or non-string WIFs', () => {
    expect(() => new BitcoinSigner({ wif: '' })).toThrow(ValidationError);
    expect(() => new BitcoinSigner({ wif: 123 as never })).toThrow(ValidationError);
  });

  it('rejects malformed WIFs at sign() time', async () => {
    const signer = new BitcoinSigner({ wif: 'not-a-valid-wif' });
    await expect(signer.sign(TEST_MESSAGE)).rejects.toThrow();
  });

  it('fromWif matches the constructor', async () => {
    const a = await new BitcoinSigner({ wif: BITCOIN_PRIVATE_KEY }).sign(TEST_MESSAGE);
    const b = await BitcoinSigner.fromWif(BITCOIN_PRIVATE_KEY).sign(TEST_MESSAGE);
    expect(b.signerId).toBe(a.signerId);
    expect(toHex(b.signatureBytes)).toBe(toHex(a.signatureBytes));
  });

  it('signs the same message identically across runs', async () => {
    const signer = new BitcoinSigner({ wif: BITCOIN_PRIVATE_KEY });
    const [a, b] = await Promise.all([signer.sign(TEST_MESSAGE), signer.sign(TEST_MESSAGE)]);
    expect(a.signerId).toBe(b.signerId);
    expect(toHex(a.signatureBytes)).toBe(toHex(b.signatureBytes));
  });
});

describe('AleoSourceSigner', () => {
  const stubFactory = {
    fromSeed: () => ({ privateKey: 'pk', viewKey: 'vk', address: 'aleo1stub' }),
    sign: async (privateKey: string | undefined, _message: Uint8Array) => ({
      privateKey: privateKey ?? 'APrivateKey1zkpStubGenerated',
      address: 'aleo1stubaddress',
      signature: 'sign1stub_signature_string',
    }),
  };

  it('reports chain="aleo" and signs through the factory', async () => {
    const signer = new AleoSourceSigner({ factory: stubFactory, privateKey: 'APrivateKey1zkpFixed' });
    expect(signer.chain).toBe('aleo');
    const signed = await signer.sign('hello');
    expect(signed.signerId).toBe('aleo1stubaddress');
    expect(signed.signatureDisplay).toBe('sign1stub_signature_string');
    expect(signed.signatureBytes.length).toBeGreaterThan(0);
  });

  it('throws WalletError when the factory does not implement sign()', async () => {
    const signer = new AleoSourceSigner({
      factory: { fromSeed: () => ({ privateKey: 'pk', viewKey: 'vk', address: 'a' }) },
    });
    await expect(signer.sign('hi')).rejects.toBeInstanceOf(WalletError);
  });
});
