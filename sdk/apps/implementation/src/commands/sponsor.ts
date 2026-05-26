import { FeeSponsorClient } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv } from '../utils.js';

// pnpm sponsor --program sample_program.aleo --function main --inputs 1u32,2u32
//
// Builds the program authorization + executionId + base-fee estimate locally,
// then asks the fee-sponsor server (via the SDK's FeeSponsorClient) to sign
// the fee. Finally assembles a ProvingRequest from both authorizations and,
// if PROVER_URL is set, submits it to a delegated prover.
export async function runSponsor(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const programName = (args.flags['program'] as string | undefined) ?? 'sample_program.aleo';
  const functionName = (args.flags['function'] as string | undefined) ?? 'main';
  const inputs = ((args.flags['inputs'] as string | undefined) ?? '1u32,2u32')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const priorityFeeCredits = Number(args.flags['priority'] ?? 0);
  const broadcast =
    (args.flags['broadcast'] as string | true | undefined)?.toString().toLowerCase() !== 'false';

  const network = (process.env.ALEO_NETWORK ?? 'testnet') === 'mainnet' ? 'mainnet' : 'testnet';
  const host = process.env.ALEO_API_HOST ?? 'https://api.provable.com/v2';
  const userPk = requireEnv('USER_ALEO_PRIVATE_KEY');
  const apiKey = requireEnv('FEE_SPONSOR_API_KEY');

  const sdk = (await import(
    `@provablehq/sdk/${network === 'mainnet' ? 'mainnet.js' : 'testnet.js'}`
  )) as any;

  const account = new sdk.Account({ privateKey: userPk });
  const networkClient = new sdk.AleoNetworkClient(host);
  const keyProvider = new sdk.AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new sdk.NetworkRecordProvider(account, networkClient);
  const pm = new sdk.ProgramManager(host, keyProvider, recordProvider);
  pm.setAccount(account);

  const authorization = await pm.buildAuthorization({ programName, functionName, inputs });
  const executionId: string = authorization.toExecutionId().toString();
  const baseFeeMicro: bigint = await pm.estimateFeeForAuthorization({ programName, authorization });
  const baseFeeCredits = Number(baseFeeMicro) / 1_000_000;

  const client = new FeeSponsorClient({
    apiKey,
    ...(process.env.FEE_SPONSOR_URL ? { baseUrl: process.env.FEE_SPONSOR_URL } : {}),
  });
  const feeAuth = await client.requestFeeAuthorization({
    executionId,
    baseFeeCredits,
    priorityFeeCredits,
  });

  const feeAuthObj = sdk.Authorization.fromString(feeAuth.feeAuthorization);
  const provingRequest = sdk.ProvingRequest.new(authorization, feeAuthObj, broadcast);

  const summary = {
    programName,
    functionName,
    inputs,
    executionId,
    baseFeeCredits,
    priorityFeeCredits,
    sponsorAddress: feeAuth.sponsorAddress,
    provingRequest: provingRequest.toString(),
  };

  const proverUrl = process.env.PROVER_URL;
  if (!proverUrl) {
    printJson({ ...summary, submitted: false });
    return;
  }

  const submitArgs: Record<string, unknown> = { provingRequest, url: proverUrl };
  if (process.env.PROVER_API_KEY) submitArgs.apiKey = process.env.PROVER_API_KEY;
  if (process.env.PROVER_CONSUMER_ID) submitArgs.consumerId = process.env.PROVER_CONSUMER_ID;
  if (process.env.PROVER_DPS_PRIVACY !== undefined) {
    submitArgs.dpsPrivacy = process.env.PROVER_DPS_PRIVACY.toLowerCase() !== 'false';
  }
  const proving = await networkClient.submitProvingRequest(submitArgs);
  printJson({ ...summary, submitted: true, proving });
}
