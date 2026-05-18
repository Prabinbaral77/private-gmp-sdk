import { DEFAULT_HKDF_INFO_UTF8, resolveDomainSeparator } from '../constants/derivation';
import { ValidationError } from '../utils/errors';

import { createProvableHqAccountFactory } from './account';
import { assertSourceChain, deriveAleoSeed, domainSalt } from './seed';

import type {
  AleoAccountDeriverOptions,
  AleoAccountFactory,
  AleoNetwork,
  DeriveAleoAccountInput,
  DerivedAleoAccount,
} from '../types/derivation';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Derives 32-byte HKDF seeds from foreign-chain signatures and materialises
 * Aleo accounts from them.
 *
 * Shared configuration (network, account factory) is supplied to the
 * constructor; per-signature inputs go to {@link derive}. The domain separator
 * and HKDF info are fixed constants — see {@link resolveDomainSeparator} and
 * {@link DEFAULT_HKDF_INFO_UTF8}. The caller is responsible for producing the
 * signature — either via a user's wallet or via the per-chain signing helpers
 * in the implementation app.
 */
export class AleoAccountDeriver {
  private readonly network: AleoNetwork;
  private readonly factory: AleoAccountFactory;

  constructor(options: AleoAccountDeriverOptions = {}) {
    this.network = options.network ?? 'testnet';
    this.factory = options.accountFactory ?? createProvableHqAccountFactory(this.network);
  }

  async derive(input: DeriveAleoAccountInput): Promise<DerivedAleoAccount> {
    assertSourceChain(input.chain);
    if (typeof input.signerId !== 'string' || input.signerId.length === 0) {
      throw new ValidationError(
        'AleoAccountDeriver.derive: signerId must be a non-empty string.',
      );
    }
    if (!(input.signatureBytes instanceof Uint8Array) || input.signatureBytes.length === 0) {
      throw new ValidationError(
        'AleoAccountDeriver.derive: signatureBytes must be a non-empty Uint8Array.',
      );
    }
    if (typeof input.message !== 'string' || input.message.length === 0) {
      throw new ValidationError(
        'AleoAccountDeriver.derive: message must be a non-empty string.',
      );
    }

    const seed = deriveAleoSeed({
      chain: input.chain,
      signerId: input.signerId,
      signatureBytes: input.signatureBytes,
      message: input.message,
    });

    const keys = await this.factory.fromSeed(seed);
    const signatureDisplay = input.signatureDisplay ?? `0x${toHex(input.signatureBytes)}`;
    const domainSeparator = resolveDomainSeparator(input.chain);

    return {
      source: {
        chain: input.chain,
        signerId: input.signerId,
        signature: signatureDisplay,
        message: input.message,
      },
      derivation: {
        domainSeparator,
        hkdfInfoUtf8: DEFAULT_HKDF_INFO_UTF8,
        saltSha256DomainHex: toHex(domainSalt(domainSeparator)),
        seed,
      },
      aleo: { network: this.network, ...keys },
    };
  }
}
