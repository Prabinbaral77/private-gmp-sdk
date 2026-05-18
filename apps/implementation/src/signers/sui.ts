import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import nacl from 'tweetnacl';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const SUI_SEED_LENGTH = 32;
const ED25519_PUBLIC_KEY_LENGTH = 32;
const SUI_SCHEME_FLAG_ED25519 = 0x00;

function suiAddressFromPublicKey(publicKey: Uint8Array): string {
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

export async function signSuiMessage(
  seedHex: string,
  message: string,
): Promise<SignedMessage> {
  const cleaned = seedHex.replace(/^0x/, '');
  const seed = Uint8Array.from(Buffer.from(cleaned, 'hex'));
  if (seed.length !== SUI_SEED_LENGTH) {
    throw new Error(`Sui seed must be ${SUI_SEED_LENGTH} bytes (got ${seed.length}).`);
  }
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
  return {
    signerId: suiAddressFromPublicKey(keypair.publicKey),
    signatureBytes,
    signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
  };
}
