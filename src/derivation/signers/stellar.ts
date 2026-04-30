import { Buffer } from 'node:buffer';

import { STELLAR_SEED_LENGTH } from '../../constants/derivation';
import { ValidationError, WalletError } from '../../utils/errors';

import type {
  CrossChainSigner,
  SignedMessage,
  StellarSignerOptions,
} from '../../types/derivation';

type StellarKeypairLike = {
  publicKey(): string;
  rawSecretKey(): Buffer;
  sign(data: Buffer): Buffer;
};

type StellarKeypairCtor = {
  fromSecret(secret: string): StellarKeypairLike;
  fromRawEd25519Seed(seed: Buffer): StellarKeypairLike;
};

async function loadStellar(): Promise<{ Keypair: StellarKeypairCtor }> {
  try {
    const mod = (await import('@stellar/stellar-sdk')) as unknown as {
      Keypair: StellarKeypairCtor;
    };
    return { Keypair: mod.Keypair };
  } catch (err) {
    throw new WalletError('StellarSigner requires optional peer dep: @stellar/stellar-sdk.', err);
  }
}

export class StellarSigner implements CrossChainSigner {
  public readonly chain = 'stellar' as const;

  constructor(private readonly options: StellarSignerOptions) {
    if (typeof options.secret !== 'string' || options.secret.length === 0) {
      throw new ValidationError('StellarSigner: secret must be a non-empty StrKey string.');
    }
    if (!options.secret.startsWith('S')) {
      throw new ValidationError(
        'StellarSigner: secret must be a Stellar StrKey-encoded ed25519 seed (starts with "S").',
      );
    }
  }

  static fromSecret(secret: string): StellarSigner {
    return new StellarSigner({ secret });
  }

  static async fromRawSeedHex(hex: string): Promise<StellarSigner> {
    const cleaned = hex.replace(/^0x/, '');
    if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
      throw new ValidationError('StellarSigner: seed must be a valid hex string.');
    }
    const bytes = Buffer.from(cleaned, 'hex');
    if (bytes.length !== STELLAR_SEED_LENGTH) {
      throw new ValidationError(
        `StellarSigner: seed must be ${STELLAR_SEED_LENGTH} bytes (received ${bytes.length}).`,
      );
    }
    const { Keypair } = await loadStellar();
    const kp = Keypair.fromRawEd25519Seed(bytes);
    return new StellarSigner({ secret: (kp as unknown as { secret(): string }).secret() });
  }

  async sign(message: string): Promise<SignedMessage> {
    const { Keypair } = await loadStellar();
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
