import { FeeSponsorshipService } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv, requireFlag } from '../utils.js';

type Mode = 'onchain' | 'delegated';

// pnpm sponsor:delegated --program sample_program.aleo --function main --input 1u32 --input 2u32
function buildService(): FeeSponsorshipService {
  const network = (process.env.ALEO_NETWORK ?? 'testnet') === 'mainnet' ? 'mainnet' : 'testnet';
  const host = process.env.ALEO_API_HOST;
  return new FeeSponsorshipService({
    network,
    ...(host ? { host } : {}),
    userPrivateKey: requireEnv('USER_ALEO_PRIVATE_KEY'),
    sponsorPrivateKey: requireEnv('SPONSOR_ALEO_PRIVATE_KEY'),
  });
}

export async function runSponsor(mode: Mode, argv: string[]): Promise<void> {
  const args = parseArgs(argv, new Set(['input']));
  const programName = requireFlag(args, 'program');
  const functionName = requireFlag(args, 'function');
  const inputsFlag = args.flags['input'];
  const inputs = Array.isArray(inputsFlag) ? inputsFlag : inputsFlag ? [inputsFlag as string] : [];
  if (inputs.length === 0) {
    throw new Error('At least one --input is required.');
  }
  const priorityFee = Number(args.flags['priorityFee'] ?? process.env.PRIORITY_FEE ?? '0');
  const service = buildService();

  if (mode === 'onchain') {
    printJson(await service.submitOnchain({ programName, functionName, inputs, priorityFee }));
    return;
  }

  const broadcast = args.flags['broadcast'] !== 'true';
  const splitFeeAuthorization = args.flags['splitFeeAuthorization'] !== 'true';
  const privateFee = args.flags['privateFee'] === 'false';

  const proverUrl = (args.flags['proverUrl'] as string | undefined) ?? process.env.PROVER_URL;
  const proverApiKey = (args.flags['proverApiKey'] as string | undefined) ?? process.env.PROVER_API_KEY;
  const proverConsumerId =
    (args.flags['proverConsumerId'] as string | undefined) ?? process.env.PROVER_CONSUMER_ID;

  printJson(
    await service.submitDelegated({
      programName,
      functionName,
      inputs,
      priorityFee,
      privateFee,
      broadcast,
      splitFeeAuthorization,
      prover: {
        ...(proverUrl ? { url: proverUrl } : {}),
        ...(proverApiKey ? { apiKey: proverApiKey } : {}),
        ...(proverConsumerId ? { consumerId: proverConsumerId } : {}),
      },
    }),
  );
}
