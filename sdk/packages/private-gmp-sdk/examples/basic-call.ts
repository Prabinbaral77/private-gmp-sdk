/**
 * examples/basic-call.ts
 *
 * Prepares (without broadcasting) a `credits.aleo/transfer_public` call.
 * Useful for verifying input encoding before plugging in a real wallet.
 *
 *   npm run example:basic
 */
import { AleoClient, InMemoryWalletAdapter, type AleoAddress } from '../src';
import { CREDITS_ABI } from '../tests/fixtures/sample-data';

async function main(): Promise<void> {
  const sender = ('aleo1' + 'a'.repeat(58)) as AleoAddress;
  const recipient = ('aleo1' + 'b'.repeat(58)) as AleoAddress;

  const client = new AleoClient({
    network: 'testnet',
    wallet: new InMemoryWalletAdapter(sender),
    programAbis: [CREDITS_ABI],
    logLevel: 'info',
  });

  const prepared = client.prepare({
    programId: 'credits.aleo',
    functionName: 'transfer_public',
    inputs: [recipient, 1_000_000n],
    fee: 300_000n,
  });

  console.info('Prepared call:', prepared);

  const txId = await client.submit({
    programId: 'credits.aleo',
    functionName: 'transfer_public',
    inputs: [recipient, 1_000_000n],
  });

  console.info('Submitted tx:', txId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
