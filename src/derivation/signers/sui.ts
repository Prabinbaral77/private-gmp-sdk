import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import {
  ED25519_PUBLIC_KEY_LENGTH,
  SUI_SCHEME_FLAG_ED25519,
  SUI_SEED_LENGTH,
} from '../../constants/derivation';
import { ValidationError, WalletError } from '../../utils/errors';

import type {
  CrossChainSigner,
  SignedMessage,
  SuiSignerOptions,
} from '../../types/derivation';

type NaclSignLike = {
  sign: {
    detached(msg: Uint8Array, secretKey: Uint8Array): Uint8Array;
    keyPair: { fromSeed(seed: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } };
  };
};

const pickDefault = <T>(mod: unknown): T => {
  const m = mod as { default?: T };
  return (m.default ?? (mod as T)) as T;
};

async function loadNacl(): Promise<NaclSignLike> {
  try {
    const mod = await import('tweetnacl');
    return pickDefault<NaclSignLike>(mod);
  } catch (err) {
    throw new WalletError('SuiSigner requires optional peer dep: tweetnacl.', err);
  }
}

/**
 * Sui address: blake2b-256(scheme_flag || pubkey), hex-prefixed.
 *
 * Node's `blake2b512` digest, truncated to 32 bytes, matches Sui's blake2b-256
 * for these inputs (Sui's scheme flag is one byte and the pubkey is 32 bytes).
 */
export function suiAddressFromPublicKey(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new ValidationError(
      `Sui ed25519 public key must be ${ED25519_PUBLIC_KEY_LENGTH} bytes.`,
    );
  }
  const digest = createHash('blake2b512')
    .update(new Uint8Array([SUI_SCHEME_FLAG_ED25519]))
    .update(publicKey)
    .digest()
    .subarray(0, 32);
  return `0x${Buffer.from(digest).toString('hex')}`;
}

export class SuiSigner implements CrossChainSigner {
  public readonly chain = 'sui' as const;

  constructor(private readonly options: SuiSignerOptions) {
    if (!(options.seed instanceof Uint8Array)) {
      throw new ValidationError('SuiSigner: seed must be a Uint8Array.');
    }
    if (options.seed.length !== SUI_SEED_LENGTH) {
      throw new ValidationError(
        `SuiSigner: seed must be ${SUI_SEED_LENGTH} bytes (received ${options.seed.length}).`,
      );
    }
  }

  static fromHexSeed(hex: string): SuiSigner {
    const cleaned = hex.replace(/^0x/, '');
    return new SuiSigner({ seed: Uint8Array.from(Buffer.from(cleaned, 'hex')) });
  }

  static fromBase64Seed(b64: string): SuiSigner {
    return new SuiSigner({ seed: Uint8Array.from(Buffer.from(b64, 'base64')) });
  }

  async sign(message: string): Promise<SignedMessage> {
    const nacl = await loadNacl();
    const keypair = nacl.sign.keyPair.fromSeed(this.options.seed);
    const msgBytes = new TextEncoder().encode(message);
    const signatureBytes = nacl.sign.detached(msgBytes, keypair.secretKey);
    return {
      signerId: suiAddressFromPublicKey(keypair.publicKey),
      signatureBytes,
      signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
    };
  }
}
