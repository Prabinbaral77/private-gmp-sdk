/**
 * examples/transfer.ts
 *
 * End-to-end transfer using a (mocked) Sodax wallet. Replace `mockSodax`
 * below with your real `@sodax/wallet-sdk` instance to broadcast on testnet.
 *
 *   npm run example:transfer
 */
import 'dotenv/config';

import {
  AleoClient,
  SodaxWalletAdapter,
  type AleoAddress,
  type SodaxWalletLike,
} from '../src';

async function main(): Promise<void> {
  const sender = (process.env['ALEO_ADDRESS'] ?? 'aleo1' + 'a'.repeat(58)) as AleoAddress;
  const recipient = ('aleo1' + 'b'.repeat(58)) as AleoAddress;

  // Replace this with: const sodax = await createSodaxWallet({ apiKey: ... });
  const mockSodax: SodaxWalletLike = {
    getAddress: () => Promise.resolve(sender),
    sendTransaction: async (payload) => {
      console.info('[mock-sodax] sendTransaction', payload);
      return { id: 'at1' + 'z'.repeat(58), accepted: true };
    },
  };

  const wallet = new SodaxWalletAdapter(mockSodax);

  const client = new AleoClient({
    network: (process.env['ALEO_NETWORK'] as 'testnet' | 'mainnet' | undefined) ?? 'testnet',
    wallet,
  });

  const txId = await client.submit({
    programId: 'credits.aleo',
    functionName: 'transfer_public',
    inputs: [recipient, BigInt(process.env['TRANSFER_AMOUNT'] ?? '1000000')],
    fee: BigInt(process.env['ALEO_DEFAULT_FEE'] ?? '300000'),
  });

  console.info('Broadcast tx:', txId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
