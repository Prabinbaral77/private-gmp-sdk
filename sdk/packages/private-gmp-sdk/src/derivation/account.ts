import { ALEO_SEED_LENGTH } from '../constants/derivation';
import { ValidationError, WalletError } from '../utils/errors';

import type { AleoAccountFactory, AleoAccountKeys, AleoNetwork } from '../types/derivation';
import type { ProvableHqAccount, ProvableHqModule } from '../types/provablehq';

async function loadProvableHq(network: AleoNetwork): Promise<ProvableHqModule> {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new ValidationError(`Unsupported Aleo network '${String(network)}'.`);
  }
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as unknown as ProvableHqModule;
  } catch (err) {
    throw new WalletError(
      `createProvableHqAccountFactory requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

function toKeys(account: ProvableHqAccount): AleoAccountKeys {
  return {
    privateKey: account.privateKey().to_string(),
    viewKey: account.viewKey().to_string(),
    address: account.address().to_string(),
  };
}

/**
 * Default {@link AleoAccountFactory} backed by `@provablehq/sdk`.
 * `@provablehq/sdk` must be installed by the consumer when this factory is used.
 */
export function createProvableHqAccountFactory(network: AleoNetwork): AleoAccountFactory {
  let cached: ProvableHqModule | undefined;
  const ensure = async (): Promise<ProvableHqModule> => {
    if (!cached) {
      cached = await loadProvableHq(network);
    }
    return cached;
  };

  return {
    async fromSeed(seed) {
      if (!(seed instanceof Uint8Array) || seed.length !== ALEO_SEED_LENGTH) {
        throw new ValidationError(
          `Aleo account seed must be a ${ALEO_SEED_LENGTH}-byte Uint8Array.`,
        );
      }
      const { Account } = await ensure();
      return toKeys(new Account({ seed }));
    },
    async fromPrivateKey(privateKey) {
      const { Account } = await ensure();
      return toKeys(new Account({ privateKey }));
    },
  };
}
