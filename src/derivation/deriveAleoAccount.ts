import { DEFAULT_DOMAIN_SEPARATOR, DEFAULT_HKDF_INFO_UTF8 } from '../constants/derivation';
import { ValidationError } from '../utils/errors';

import { createProvableHqAccountFactory } from './account';
import { deriveAleoSeed, domainSalt } from './seed';

import type { DeriveAleoAccountOptions, DerivedAleoAccount } from '../types/derivation';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Sign a message on the source chain, derive a 32-byte seed, and materialise an
 * Aleo account from it. This is the main entry point most consumers want.
 *
 * The pure seed derivation lives in {@link deriveAleoSeed}; this function adds
 * the I/O layer (signing + Aleo account creation).
 */
export async function deriveAleoAccount(
  options: DeriveAleoAccountOptions,
): Promise<DerivedAleoAccount> {
  if (!options.signer) {
    throw new ValidationError('deriveAleoAccount: signer is required.');
  }
  if (typeof options.message !== 'string' || options.message.length === 0) {
    throw new ValidationError('deriveAleoAccount: message must be a non-empty string.');
  }

  const network = options.network ?? 'testnet';
  console.log("accoountf actory from sdk", options);
  // console.log("createProvableHqAccountFactory(network)", createProvableHqAccountFactory(network).fromSeed());
  
  
  const factory = options.accountFactory ?? createProvableHqAccountFactory(network);
  const domainSeparator = options.domainSeparator ?? DEFAULT_DOMAIN_SEPARATOR;
  const hkdfInfoUtf8 = options.hkdfInfoUtf8 ?? DEFAULT_HKDF_INFO_UTF8;

  const signed = await options.signer.sign(options.message);
  const seed = deriveAleoSeed({
    chain: options.signer.chain,
    signerId: signed.signerId,
    signatureBytes: signed.signatureBytes,
    message: options.message,
    domainSeparator,
    hkdfInfoUtf8,
  });

  const keys = await factory.fromSeed(seed);
  // const keys = new Account

  return {
    source: {
      chain: options.signer.chain,
      signerId: signed.signerId,
      signature: signed.signatureDisplay,
      message: options.message,
    },
    derivation: {
      domainSeparator,
      hkdfInfoUtf8,
      saltSha256DomainHex: toHex(domainSalt(domainSeparator)),
      seed,
    },
    aleo: { network, ...keys },
  };
}
