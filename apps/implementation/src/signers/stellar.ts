import { Buffer } from 'node:buffer';

import { Keypair } from '@stellar/stellar-sdk';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

export function generateStellarSecret(): string {
  return Keypair.random().secret();
}

export async function signStellarMessage(
  secret: string,
  message: string,
): Promise<SignedMessage> {
  if (!secret.startsWith('S')) {
    throw new Error('Stellar secret must be a StrKey-encoded ed25519 seed (starts with "S").');
  }
  const keypair = Keypair.fromSecret(secret);
  const signatureBytes = Uint8Array.from(
    keypair.sign(Buffer.from(new TextEncoder().encode(message))),
  );
  return {
    signerId: keypair.publicKey(),
    signatureBytes,
    signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
  };
}
