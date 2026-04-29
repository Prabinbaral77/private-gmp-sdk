import { describe, expect, it, vi } from 'vitest';

import { AleoClient } from '@/client';
import { InMemoryWalletAdapter } from '@/wallet';

import { CREDITS_ABI, SAMPLE_ADDRESS, SAMPLE_RECIPIENT } from '../fixtures/sample-data';

import type { TransactionId, TransactionReceipt } from '@/types/transaction';

const finalizedReceipt = (id: TransactionId): TransactionReceipt => ({
  id,
  status: 'finalized',
  programId: 'credits.aleo',
  functionName: 'transfer_public',
  caller: SAMPLE_ADDRESS,
  fee: 300_000n,
  blockHeight: 100,
  timestamp: Date.now(),
});

describe('AleoClient (integration)', () => {
  it('prepares a call without network IO', () => {
    const client = new AleoClient({
      network: 'testnet',
      wallet: new InMemoryWalletAdapter(SAMPLE_ADDRESS),
      programAbis: [CREDITS_ABI],
    });

    const prepared = client.prepare({
      programId: 'credits.aleo',
      functionName: 'transfer_public',
      inputs: [SAMPLE_RECIPIENT, 1_000n],
    });

    expect(prepared.encodedInputs).toEqual([SAMPLE_RECIPIENT, '1000u64']);
  });

  it('submits via the wallet and returns a tx id', async () => {
    const client = new AleoClient({
      network: 'testnet',
      wallet: new InMemoryWalletAdapter(SAMPLE_ADDRESS),
      programAbis: [CREDITS_ABI],
    });

    const id = await client.submit({
      programId: 'credits.aleo',
      functionName: 'transfer_public',
      inputs: [SAMPLE_RECIPIENT, 1_000n],
    });
    expect(id.startsWith('at1')).toBe(true);
  });

  it('polls the RPC until finalization', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      const id = url.split('/').pop() as TransactionId;
      const body = JSON.stringify(finalizedReceipt(id), (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    const client = new AleoClient({
      network: 'testnet',
      wallet: new InMemoryWalletAdapter(SAMPLE_ADDRESS),
      programAbis: [CREDITS_ABI],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const receipt = await client.call({
      programId: 'credits.aleo',
      functionName: 'transfer_public',
      inputs: [SAMPLE_RECIPIENT, 1_000n],
    });

    expect(receipt.status).toBe('finalized');
    expect(fetchImpl).toHaveBeenCalled();
  });
});
