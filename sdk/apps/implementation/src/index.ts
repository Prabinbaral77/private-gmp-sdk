import { runDerive } from './commands/derive-aleo-wallet.js';
import { runScan } from './commands/recordscanner.js';
import { loadDotenv } from './utils.js';

const HELP = `Usage: sdk-tester <command> [options]

Commands:
  derive --chain <chain> [message...]
      Derive an Aleo account from a foreign-chain signer.
      chain: aleo | evm | solana | sui | bitcoin | stellar | stacks

  scan --mode <hosted|sdk> --programs <a.aleo,b.aleo> [--limit 25]
      Scan owned records for the configured USER_ALEO_PRIVATE_KEY.

Environment (read from apps/implementation/.env):
  ALEO_NETWORK, ALEO_API_HOST
  USER_ALEO_PRIVATE_KEY
  SCANNER_API_KEY, SCANNER_CONSUMER_ID, ALEO_SCANNER_URL
  Chain keys: EVM_PRIVATE_KEY, SOLANA_PRIVATE_KEY, SUI_PRIVATE_KEY,
              BITCOIN_WIF, STELLAR_SECRET_KEY, STACKS_PRIVATE_KEY,
              ALEO_SOURCE_PRIVATE_KEY
`;

async function main(): Promise<void> {
  loadDotenv();
  const [, , command, sub, ...rest] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'derive':
      await runDerive([sub, ...rest].filter(Boolean) as string[]);
      return;
    case 'scan':
      await runScan([sub, ...rest].filter(Boolean) as string[]);
      return;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
