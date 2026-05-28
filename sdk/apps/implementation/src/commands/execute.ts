import { AleoWalletProvider } from '@venture23-aleo/private-gmp-sdk/wallet';
import type { AleoDelegateConfig } from '@venture23-aleo/private-gmp-sdk/wallet';
import { SampleProgram } from '@venture23-aleo/private-gmp-sdk/contracts';
import type { AleoNetwork } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv } from '../utils.js';

// pnpm execute [--r0 1] [--r1 2] [--priority 0] [--private-fee false] [--wait true] [--delegate [url]]
//
// Calls `sample_program.aleo/main(r0: u32.public, r1: u32.private)` via
// AleoWalletProvider.callSampleMain. The program name, function name, and
// input signature are baked into the SDK — the SDK validates that r0/r1 fit
// the u32 range before signing. The wallet (USER_ALEO_PRIVATE_KEY) pays its
// own fee whether proving is local or delegated.
export async function runExecute(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const r0 = readU32(args.flags['r0'], 'r0', 1);
  const r1 = readU32(args.flags['r1'], 'r1', 2);
  const priorityFee = Number(args.flags['priority'] ?? 0);
  const privateFee =
    (args.flags['private-fee'] as string | true | undefined)?.toString().toLowerCase() === 'true';
  const wait =
    (args.flags['wait'] as string | true | undefined)?.toString().toLowerCase() !== 'false';
  const delegate = readDelegateConfig(args.flags['delegate']);

  const network: AleoNetwork =
    (process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const rpcUrl = process.env.ALEO_API_HOST ?? 'https://api.provable.com/v2';
  const privateKey = requireEnv('USER_ALEO_PRIVATE_KEY');

  const wallet = new AleoWalletProvider({
    network,
    rpcUrl,
    privateKey,
    ...(delegate && { delegate }),
  });
  const address = await wallet.getAddress();
  const sampleProgram = new SampleProgram(wallet);

  const callOptions = { priorityFee, privateFee };

  if (!wait) {
    const result = await sampleProgram.main(r0, r1, callOptions);
    printJson({ network, address, r0, r1, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await sampleProgram.mainAndWait(r0, r1, callOptions);
  printJson({
    network,
    address,
    r0,
    r1,
    transactionId: result.transactionId,
    receipt: {
      status: receipt.status,
      type: receipt.type,
      index: receipt.index,
      confirmedAt: receipt.confirmedAt.toISOString(),
    },
  });
}

function readU32(
  flag: string | string[] | true | undefined,
  name: string,
  fallback: number,
): number {
  if (flag === undefined || flag === true) return fallback;
  const raw = typeof flag === 'string' ? flag : flag[0];
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a number, received '${String(raw)}'.`);
  }
  return value;
}

function readDelegateConfig(
  flag: string | string[] | true | undefined,
): AleoDelegateConfig | undefined {
  if (flag === undefined) return undefined;
  const url = typeof flag === 'string' ? flag : (process.env.PROVER_URL ?? '');
  if (!url) {
    throw new Error('--delegate requires either an explicit URL or PROVER_URL in the env.');
  }
  const dpsPrivacyEnv = process.env.PROVER_DPS_PRIVACY;
  return {
    url,
    ...(process.env.PROVER_API_KEY !== undefined && { apiKey: process.env.PROVER_API_KEY }),
    ...(process.env.PROVER_CONSUMER_ID !== undefined && { consumerId: process.env.PROVER_CONSUMER_ID }),
    ...(dpsPrivacyEnv !== undefined && { dpsPrivacy: dpsPrivacyEnv.toLowerCase() !== 'false' }),
  };
}
