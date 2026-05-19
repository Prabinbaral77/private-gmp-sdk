import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import nacl from 'tweetnacl';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const SUI_SEED_LENGTH = 32;
const ED25519_PUBLIC_KEY_LENGTH = 32;
const SUI_SCHEME_FLAG_ED25519 = 0x00;

export type SuiSignerOptions = {
  /** Hex-encoded 32-byte ed25519 seed (optionally `0x`-prefixed). */
  readonly seed: string;
};

/**
 * Sui address: blake2b-256(scheme_flag || pubkey), hex-prefixed.
 *
 * Node's `blake2b512` digest truncated to 32 bytes matches Sui's blake2b-256
 * for these inputs (scheme flag is one byte, pubkey is 32 bytes).
 */
export function suiAddressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error(`Sui ed25519 public key must be ${ED25519_PUBLIC_KEY_LENGTH} bytes.`);
  }
  const digest = createHash('blake2b512')
    .update(new Uint8Array([SUI_SCHEME_FLAG_ED25519]))
    .update(publicKey)
    .digest()
    .subarray(0, 32);
  return `0x${Buffer.from(digest).toString('hex')}`;
}

export class SuiSigner {
  public readonly chain = 'sui' as const;

  private readonly seedBytes: Uint8Array;

  constructor(options: SuiSignerOptions) {
    if (typeof options.seed !== 'string' || options.seed.length === 0) {
      throw new Error('SuiSigner: seed must be a hex-encoded string.');
    }
    const cleaned = options.seed.replace(/^0x/, '');
    if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
      throw new Error('SuiSigner: seed must be a valid hex string.');
    }
    const bytes = Uint8Array.from(Buffer.from(cleaned, 'hex'));
    if (bytes.length !== SUI_SEED_LENGTH) {
      throw new Error(`SuiSigner: seed must be ${SUI_SEED_LENGTH} bytes (received ${bytes.length}).`);
    }
    this.seedBytes = bytes;
  }

  static fromHexSeed(hex: string): SuiSigner {
    return new SuiSigner({ seed: hex });
  }

  static fromBase64Seed(b64: string): SuiSigner {
    return new SuiSigner({ seed: Buffer.from(b64, 'base64').toString('hex') });
  }

  async sign(message: string): Promise<SignedMessage> {
    const keypair = nacl.sign.keyPair.fromSeed(this.seedBytes);
    const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    return {
      signerId: suiAddressFromPublicKey(keypair.publicKey),
      signatureBytes,
      signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
    };
  }
}
