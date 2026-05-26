import { runDerive } from './commands/derive-aleo-wallet.js';
import { runScan } from './commands/recordscanner.js';
import { runSponsor } from './commands/sponsor.js';
import { loadDotenv } from './utils.js';

const HELP = `Usage: sdk-tester <command> [options]

Commands:
  derive --chain <chain> [message...]
      Derive an Aleo account from a foreign-chain signer.
      chain: aleo | evm | solana | sui | bitcoin | stellar | stacks

  scan --mode <hosted|sdk> --programs <a.aleo,b.aleo> [--limit 25]
      Scan owned records for the configured USER_ALEO_PRIVATE_KEY.

  sponsor --program <name.aleo> --function <fn> --inputs <a,b,...> [--priority 0] [--broadcast true]
      Build a program authorization locally, request a sponsored fee
      authorization via the SDK's FeeSponsorClient, and assemble a
      ProvingRequest. Submits to PROVER_URL if set.

Environment (read from apps/implementation/.env):
  ALEO_NETWORK, ALEO_API_HOST
  USER_ALEO_PRIVATE_KEY
  SCANNER_API_KEY, SCANNER_CONSUMER_ID, ALEO_SCANNER_URL
  FEE_SPONSOR_URL, FEE_SPONSOR_API_KEY
  PROVER_URL, PROVER_API_KEY, PROVER_CONSUMER_ID, PROVER_DPS_PRIVACY
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
    case 'sponsor':
      await runSponsor([sub, ...rest].filter(Boolean) as string[]);
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
