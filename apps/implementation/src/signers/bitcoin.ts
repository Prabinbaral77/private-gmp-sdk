import { Buffer } from 'node:buffer';

import ecc from '@bitcoinerlab/secp256k1';
import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';
import { ECPairFactory } from 'ecpair';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

const ECPair = ECPairFactory(ecc);

export async function signBitcoinMessage(
  wif: string,
  message: string,
): Promise<SignedMessage> {
  const keyPair = ECPair.fromWIF(wif);
  if (!keyPair.privateKey) {
    throw new Error('BitcoinSigner: WIF decoded without a private key.');
  }

  const sigBuf = (
    bitcoinMessage as { sign(m: string, pk: Uint8Array, compressed: boolean): Buffer }
  ).sign(message, Buffer.from(keyPair.privateKey), keyPair.compressed);
  const signatureBytes = Uint8Array.from(sigBuf);

  const p2pkh = payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
  if (!p2pkh.address) {
    throw new Error('BitcoinSigner: failed to derive P2PKH address from public key.');
  }

  return {
    signerId: p2pkh.address,
    signatureBytes,
    signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
  };
}
