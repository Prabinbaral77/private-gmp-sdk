import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const SOLANA_SECRET_KEY_LENGTH = 64;

export async function signSolanaMessage(
  secretKeyB58: string,
  message: string,
): Promise<SignedMessage> {
  const secretKey = bs58.decode(secretKeyB58);
  if (secretKey.length !== SOLANA_SECRET_KEY_LENGTH) {
    throw new Error(
      `Solana secretKey must decode to ${SOLANA_SECRET_KEY_LENGTH} bytes (got ${secretKey.length}).`,
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
