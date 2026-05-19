import { DEFAULT_HKDF_INFO_UTF8, resolveDomainSeparator } from '../constants/derivation';
import { ValidationError, WalletError } from '../utils/errors';

import { createProvableHqAccountFactory } from './account';
import { tryFetchCachedAleoSignature } from './aleo-vault';
import { assertSourceChain, deriveAleoSeed, domainSalt } from './seed';

import type { AleoVaultLookupOptions } from './aleo-vault';
import type {
  AleoAccountDeriverOptions,
  AleoAccountFactory,
  AleoNetwork,
  DeriveAleoAccountInput,
  DerivedAleoAccount,
} from '../types/derivation';

type ProvableHqModule = typeof import('@provablehq/sdk/testnet.js');

async function loadProvableHq(network: AleoNetwork): Promise<ProvableHqModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as ProvableHqModule;
  } catch (err) {
    throw new WalletError(
      `AleoAccountDeriver.deriveFromAleoSource requires '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

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

  /**
   * Derive an Aleo wallet using an Aleo source private key.
   *
   * When `vaultOptions` is supplied, checks `veru_pcc_vault.aleo`'s
   * `is_available[BHP256(sourceAddress)]` mapping first. If the entry exists,
   * scans the user's `userInfo` records and decrypts to recover the cached
   * signature — yielding a deterministic derivation. Otherwise (or if vault
   * options aren't provided), signs locally with the Aleo SDK (note: Aleo's
   * Schnorr signing uses a fresh random nonce, so local signing produces a
   * different derived account on every call).
   *
   * This method does NOT call `set_user_info` — caching is the caller's job.
   */
  async deriveFromAleoSource(
    aleoPrivateKey: string,
    message: string,
    vaultOptions?: AleoVaultLookupOptions,
  ): Promise<DerivedAleoAccount> {
    if (typeof aleoPrivateKey !== 'string' || aleoPrivateKey.length === 0) {
      throw new ValidationError('deriveFromAleoSource: aleoPrivateKey must be non-empty.');
    }
    if (typeof message !== 'string' || message.length === 0) {
      throw new ValidationError('deriveFromAleoSource: message must be non-empty.');
    }

    if (vaultOptions) {
      const cached = await tryFetchCachedAleoSignature(aleoPrivateKey, this.network, vaultOptions);
      if (cached) {
        return this.derive({
          chain: 'aleo',
          signerId: cached.address,
          signatureBytes: new TextEncoder().encode(cached.signature),
          signatureDisplay: cached.signature,
          message,
        });
      }
    }

    const { Account } = await loadProvableHq(this.network);
    const account = new Account({ privateKey: aleoPrivateKey });
    const signature = account.sign(new TextEncoder().encode(message)).to_string();

    return this.derive({
      chain: 'aleo',
      signerId: account.address().to_string(),
      signatureBytes: new TextEncoder().encode(signature),
      signatureDisplay: signature,
      message,
    });
  }
}
