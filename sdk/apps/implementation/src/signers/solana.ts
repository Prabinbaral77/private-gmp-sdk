import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const SOLANA_SECRET_KEY_LENGTH = 64;

export type SolanaSignerOptions = {
  /** Base58-encoded 64-byte Solana secret key (seed || pubkey). */
  readonly secretKey: string;
};

export class SolanaSigner {
  public readonly chain = 'solana' as const;

  constructor(private readonly options: SolanaSignerOptions) {
    if (typeof options.secretKey !== 'string' || options.secretKey.length === 0) {
      throw new Error('SolanaSigner: secretKey must be a base58-encoded string.');
    }
  }

  static fromBase58SecretKey(b58: string): SolanaSigner {
    return new SolanaSigner({ secretKey: b58 });
  }

  static fromJsonSecretKey(json: string | readonly number[]): SolanaSigner {
    const arr = typeof json === 'string' ? (JSON.parse(json) as number[]) : json;
    return new SolanaSigner({ secretKey: bs58.encode(Uint8Array.from(arr)) });
  }

  async sign(message: string): Promise<SignedMessage> {
    const secretKey = bs58.decode(this.options.secretKey);
    if (secretKey.length !== SOLANA_SECRET_KEY_LENGTH) {
      throw new Error(
        `SolanaSigner: secretKey must decode to ${SOLANA_SECRET_KEY_LENGTH} bytes (got ${secretKey.length}).`,
      );
    }
    const keypair = Keypair.fromSecretKey(secretKey);
    const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    return {
      signerId: keypair.publicKey.toBase58(),
      signatureBytes,
      signatureDisplay: bs58.encode(signatureBytes),
    };
  }
}
