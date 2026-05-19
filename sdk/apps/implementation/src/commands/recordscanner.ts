import { RecordScannerService } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv } from '../utils.js';

// pnpm scan --mode hosted --program credits.aleo
// --mode hosted | sdk
export async function runScan(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const mode = ((args.flags['mode'] as string | undefined) ?? 'hosted') as 'hosted' | 'sdk';
  const network = (process.env.ALEO_NETWORK ?? 'testnet') === 'mainnet' ? 'mainnet' : 'testnet';
  const host = mode == 'hosted' ? process.env.ALEO_API_HOST : process.env.ALEO_SCANNER_URL ;
  const scannerUrl = process.env.ALEO_SCANNER_URL;
  const apiKey = process.env.SCANNER_API_KEY;
  const consumerId = process.env.SCANNER_CONSUMER_ID;

  const programs = ((args.flags['programs'] as string | undefined) ?? 'credits.aleo')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const hostScannerService = new RecordScannerService({
    network,
    privateKey: requireEnv('SPONSOR_ALEO_PRIVATE_KEY'),
    ...(host ? { host } : {}),
    ...(scannerUrl ? { scannerUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(consumerId ? { consumerId } : {}),
  });

  const sdkScannerService = new RecordScannerService({
    network,
    privateKey: requireEnv('SPONSOR_ALEO_PRIVATE_KEY'),
    ...(host ? { host } : {}),
    ...(scannerUrl ? { scannerUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(consumerId ? { consumerId } : {}),
  });

  const creds = apiKey && consumerId ? { apiKey, consumerId } : mode == 'hosted' ? await hostScannerService.getCredentials(): await sdkScannerService.getCredentials();

  const filter = {
    programs,
    apiKey: creds.apiKey,
    consumerId: creds.consumerId,
    limit: Number(args.flags['limit'] ?? 25),
  };

  const result = mode === 'sdk' ? await sdkScannerService.sdk(filter) : await hostScannerService.hosted(filter);
  printJson(result);
}
