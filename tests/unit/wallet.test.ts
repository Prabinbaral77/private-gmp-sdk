import { describe, expect, it, vi } from 'vitest';

import { ProgramCallBuilder } from '@/program';
import { WalletError } from '@/utils/errors';
import { InMemoryWalletAdapter, SodaxWalletAdapter } from '@/wallet';

import { SAMPLE_ADDRESS, SAMPLE_RECIPIENT } from '../fixtures/sample-data';

const buildCall = () =>
  ProgramCallBuilder.for('credits.aleo', 'transfer_public')
    .addInput(SAMPLE_RECIPIENT, 'address')
    .addInput(1n, 'u64')
    .build();

describe('InMemoryWalletAdapter', () => {
  it('returns the stored address and a deterministic id', async () => {
    const wallet = new InMemoryWalletAdapter(SAMPLE_ADDRESS);
    await expect(wallet.getAddress()).resolves.toBe(SAMPLE_ADDRESS);

    const ack = await wallet.signAndBroadcast(buildCall());
    expect(ack.accepted).toBe(true);
    expect(ack.id.startsWith('at1')).toBe(true);
  });
});

describe('SodaxWalletAdapter', () => {
  it('forwards getAddress and sendTransaction', async () => {
    const sodax = {
      getAddress: vi.fn().mockResolvedValue(SAMPLE_ADDRESS),
      sendTransaction: vi.fn().mockResolvedValue({ id: 'at1' + 'z'.repeat(58), accepted: true }),
    };
    const adapter = new SodaxWalletAdapter(sodax);

    await expect(adapter.getAddress()).resolves.toBe(SAMPLE_ADDRESS);

    const ack = await adapter.signAndBroadcast(buildCall());
    expect(ack.accepted).toBe(true);
    expect(sodax.sendTransaction).toHaveBeenCalledOnce();
    const payload = sodax.sendTransaction.mock.calls[0]?.[0] as { fee: string };
    expect(payload.fee).toBe('300000');
  });

  it('wraps Sodax failures in WalletError', async () => {
    const sodax = {
      sendTransaction: vi.fn().mockRejectedValue(new Error('boom')),
      getAddress: vi.fn().mockResolvedValue(SAMPLE_ADDRESS),
    };
    const adapter = new SodaxWalletAdapter(sodax);
    await expect(adapter.signAndBroadcast(buildCall())).rejects.toBeInstanceOf(WalletError);
  });

  it('throws when sendTransaction is unavailable', async () => {
    const adapter = new SodaxWalletAdapter({});
    await expect(adapter.signAndBroadcast(buildCall())).rejects.toBeInstanceOf(WalletError);
  });
});
