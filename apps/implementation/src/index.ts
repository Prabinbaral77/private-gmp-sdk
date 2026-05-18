import { runDerive } from './commands/derive-aleo-wallet.js';
import { runSponsor } from './commands/fee-sponsor.js';
import { runScan } from './commands/recordscanner.js';
import { loadDotenv } from './utils.js';

const HELP = `Usage: sdk-tester <command> [options]

Commands:
  derive --chain <chain> [message...]
      Derive an Aleo account from a foreign-chain signer.
      chain: aleo | evm | solana | sui | bitcoin | stellar | stacks

  scan --mode <hosted|sdk> --programs <a.aleo,b.aleo> [--limit 25]
      Scan owned records for the configured USER_ALEO_PRIVATE_KEY.

  sponsor onchain   --program <p> --function <f> --input <v> [--input <v>...] [--priorityFee 0]
  sponsor delegated --program <p> --function <f> --input <v> [--input <v>...]
                    [--splitFeeAuthorization false] [--broadcast false]
      Build and submit a fee-sponsored transaction.

Environment (read from apps/implementation/.env):
  ALEO_NETWORK, ALEO_API_HOST
  USER_ALEO_PRIVATE_KEY, SPONSOR_ALEO_PRIVATE_KEY
  PROVER_URL, PROVER_API_KEY, PROVER_CONSUMER_ID
  SCANNER_API_KEY, SCANNER_CONSUMER_ID, ALEO_SCANNER_URL
  Chain keys: EVM_PRIVATE_KEY, SOLANA_PRIVATE_KEY_B58, SUI_PRIVATE_KEY_HEX,
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
    case 'sponsor': {
      if (sub !== 'onchain' && sub !== 'delegated') {
        throw new Error("sponsor subcommand must be 'onchain' or 'delegated'");
      }
      await runSponsor(sub, rest);
      return;
    }
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
