import { ProvableConsumerService } from '@venture23-aleo/private-gmp-sdk/consumer';
import { AleoWalletProvider } from '@venture23-aleo/private-gmp-sdk/wallet';
import type { AleoNetwork } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv } from '../utils.js';

// pnpm consumer [--address aleo1...] [--username <name>] [--url https://api.provable.com]
//
// Registers a Provable consumer to mint the consumerId / apiKey pair the SDK
// uses for hosted record scanning and delegated (fee-sponsored) proving. The
// username is namespaced by the user's Aleo address — taken from --address, or
// derived from USER_ALEO_PRIVATE_KEY when --address is omitted. Stash the
// printed `consumerId` / `apiKey` in your env (SCANNER_CONSUMER_ID /
// SCANNER_API_KEY, PROVER_CONSUMER_ID / PROVER_API_KEY) for later runs.
export async function runConsumer(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const aleoAddress = await resolveAddress(args.flags['address'] as string | undefined);
  const baseUrl = (args.flags['url'] as string | undefined) ?? process.env.CONSUMER_API_URL;
  const username = args.flags['username'] as string | undefined;

  const service = new ProvableConsumerService({ ...(baseUrl !== undefined && { baseUrl }) });
  const registration = await service.register({
    aleoAddress,
    ...(username !== undefined && { username }),
  });

  printJson({ ok: true, action: 'consumer-register', aleoAddress, registration });
}

/** Use the explicit --address if given; otherwise derive it from USER_ALEO_PRIVATE_KEY. */
async function resolveAddress(addressFlag: string | undefined): Promise<string> {
  if (addressFlag) return addressFlag;
  const network: AleoNetwork =
    (process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const wallet = new AleoWalletProvider({
    network,
    rpcUrl: process.env.ALEO_API_HOST ?? 'https://api.provable.com/v2',
    privateKey: requireEnv('USER_ALEO_PRIVATE_KEY'),
  });
  return wallet.getAddress();
}
