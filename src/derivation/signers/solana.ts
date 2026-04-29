import { SOLANA_SECRET_KEY_LENGTH } from '../../constants/derivation';
import { ValidationError, WalletError } from '../../utils/errors';

import type {
  CrossChainSigner,
  SignedMessage,
  SolanaSignerOptions,
} from '../../types/derivation';

type NaclLike = {
  sign: { detached(msg: Uint8Array, secretKey: Uint8Array): Uint8Array };
};

type Bs58Like = {
  encode(data: Uint8Array): string;
  decode(s: string): Uint8Array;
};

type KeypairLike = {
  fromSecretKey(secretKey: Uint8Array): { publicKey: { toBase58(): string }; secretKey: Uint8Array };
};

const pickDefault = <T>(mod: unknown): T => {
  const m = mod as { default?: T };
  return (m.default ?? (mod as T)) as T;
};

async function loadDeps(): Promise<{ nacl: NaclLike; bs58: Bs58Like; Keypair: KeypairLike }> {
  try {
    const [naclMod, bs58Mod, web3Mod] = await Promise.all([
      import('tweetnacl'),
      import('bs58'),
      import('@solana/web3.js'),
    ]);
    return {
      nacl: pickDefault<NaclLike>(naclMod),
      bs58: pickDefault<Bs58Like>(bs58Mod),
      Keypair: (web3Mod as unknown as { Keypair: KeypairLike }).Keypair,
    };
  } catch (err) {
    throw new WalletError(
      'SolanaSigner requires optional peer deps: tweetnacl, bs58, @solana/web3.js.',
      err,
    );
  }
}

export class SolanaSigner implements CrossChainSigner {
  public readonly chain = 'solana' as const;

  constructor(private readonly options: SolanaSignerOptions) {
    if (!(options.secretKey instanceof Uint8Array)) {
      throw new ValidationError('SolanaSigner: secretKey must be a Uint8Array.');
    }
    if (options.secretKey.length !== SOLANA_SECRET_KEY_LENGTH) {
      throw new ValidationError(
        `SolanaSigner: secretKey must be ${SOLANA_SECRET_KEY_LENGTH} bytes (received ${options.secretKey.length}).`,
      );
    }
  }

  static async fromBase58SecretKey(b58: string): Promise<SolanaSigner> {
    const mod = await import('bs58');
    const bs58 = pickDefault<Bs58Like>(mod);
    return new SolanaSigner({ secretKey: bs58.decode(b58) });
  }

  static fromJsonSecretKey(json: string | readonly number[]): SolanaSigner {
    const arr = typeof json === 'string' ? (JSON.parse(json) as number[]) : json;
    return new SolanaSigner({ secretKey: Uint8Array.from(arr) });
  }

  async sign(message: string): Promise<SignedMessage> {
    const { nacl, bs58, Keypair } = await loadDeps();
    const keypair = Keypair.fromSecretKey(this.options.secretKey);
    const msgBytes = new TextEncoder().encode(message);
    const signatureBytes = nacl.sign.detached(msgBytes, keypair.secretKey);
    return {
      signerId: keypair.publicKey.toBase58(),
      signatureBytes,
      signatureDisplay: bs58.encode(signatureBytes),
    };
  }
}
