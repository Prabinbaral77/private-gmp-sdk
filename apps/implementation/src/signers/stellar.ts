import { Buffer } from 'node:buffer';

import { Keypair } from '@stellar/stellar-sdk';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const STELLAR_SEED_LENGTH = 32;

export type StellarSignerOptions = {
  /** Stellar StrKey-encoded ed25519 seed (starts with "S"). */
  readonly secret: string;
};

export class StellarSigner {
  public readonly chain = 'stellar' as const;

  constructor(private readonly options: StellarSignerOptions) {
    if (typeof options.secret !== 'string' || options.secret.length === 0) {
      throw new Error('StellarSigner: secret must be a non-empty StrKey string.');
    }
    if (!options.secret.startsWith('S')) {
      throw new Error(
        'StellarSigner: secret must be a Stellar StrKey-encoded ed25519 seed (starts with "S").',
      );
    }
  }

  static fromSecret(secret: string): StellarSigner {
    return new StellarSigner({ secret });
  }

  static fromRawSeedHex(hex: string): StellarSigner {
    const cleaned = hex.replace(/^0x/, '');
    if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
      throw new Error('StellarSigner: seed must be a valid hex string.');
    }
    const bytes = Buffer.from(cleaned, 'hex');
    if (bytes.length !== STELLAR_SEED_LENGTH) {
      throw new Error(
        `StellarSigner: seed must be ${STELLAR_SEED_LENGTH} bytes (received ${bytes.length}).`,
      );
    }
    const kp = Keypair.fromRawEd25519Seed(bytes);
    return new StellarSigner({ secret: kp.secret() });
  }

  async sign(message: string): Promise<SignedMessage> {
    const keypair = Keypair.fromSecret(this.options.secret);
    const msgBytes = Buffer.from(new TextEncoder().encode(message));
    const signatureBytes = Uint8Array.from(keypair.sign(msgBytes));
    return {
      signerId: keypair.publicKey(),
      signatureBytes,
      signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
    };
  }
}
