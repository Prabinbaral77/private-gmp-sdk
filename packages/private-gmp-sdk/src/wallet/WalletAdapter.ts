import { WalletError } from '../utils/errors';

import type { AleoAddress } from '../types/aleo';
import type { PreparedProgramCall } from '../types/program';
import type { TransactionBroadcastResult } from '../types/transaction';

/**
 * Minimal contract every wallet integration must satisfy.
 *
 * The SDK does not assume which wallet you are using — concrete
 * implementations include {@link SodaxWalletAdapter} (built on
 * `@sodax/wallet-sdk`) and {@link InMemoryWalletAdapter} for tests.
 */
export type WalletAdapter = {
  /** Stable identifier for logging / telemetry. */
  readonly name: string;

  /** Returns the active Aleo address. May trigger a connection prompt. */
  getAddress(): Promise<AleoAddress>;

  /** Sign and broadcast a prepared program call, returning the network ack. */
  signAndBroadcast(call: PreparedProgramCall): Promise<TransactionBroadcastResult>;

  /** Sign an arbitrary message — useful for off-chain auth. */
  signMessage?(message: string): Promise<string>;

  /** Optional: dispose any underlying connection / event subscription. */
  disconnect?(): Promise<void>;
};

/**
 * Adapter backed by `@sodax/wallet-sdk`.
 *
 * The Sodax SDK exposes a wallet object whose surface differs across
 * versions; this adapter narrows it to the methods the Aleo SDK actually
 * needs. Replace the call sites marked `// sodax:` with the equivalents
 * from the version you ship against.
 */
export type SodaxWalletLike = {
  // The fields below intentionally mirror the public Sodax wallet surface.
  // They are typed loosely so this adapter compiles against multiple
  // Sodax SDK versions; runtime errors surface through WalletError below.
  getAddress?: () => Promise<string> | string;
  address?: string;
  sendTransaction?: (payload: unknown) => Promise<{ id?: string; txId?: string; accepted?: boolean }>;
  signMessage?: (message: string) => Promise<string>;
  disconnect?: () => Promise<void> | void;
};

export class SodaxWalletAdapter implements WalletAdapter {
  public readonly name = 'sodax';

  constructor(private readonly wallet: SodaxWalletLike) {}

  async getAddress(): Promise<AleoAddress> {
    try {
      const raw =
        typeof this.wallet.getAddress === 'function'
          ? await this.wallet.getAddress()
          : this.wallet.address;
      if (!raw) {
        throw new WalletError('Sodax wallet did not return an address.');
      }
      return raw as AleoAddress;
    } catch (err) {
      throw new WalletError('Failed to fetch address from Sodax wallet.', err);
    }
  }

  async signAndBroadcast(call: PreparedProgramCall): Promise<TransactionBroadcastResult> {
    if (typeof this.wallet.sendTransaction !== 'function') {
      throw new WalletError(
        'Sodax wallet does not expose sendTransaction(). Update @sodax/wallet-sdk or supply a custom adapter.',
      );
    }
    try {
      const payload = {
        type: 'program-call' as const,
        programId: call.programId,
        functionName: call.functionName,
        inputs: call.encodedInputs,
        fee: call.fee.toString(),
        feeRecord: call.feeRecord,
      };
      const res = await this.wallet.sendTransaction(payload);
      const id = (res.id ?? res.txId) as string | undefined;
      if (!id) {
        throw new WalletError('Sodax wallet returned no transaction id.');
      }
      return { id: id as TransactionBroadcastResult['id'], accepted: res.accepted ?? true };
    } catch (err) {
      if (err instanceof WalletError) {
        throw err;
      }
      throw new WalletError('Sodax wallet failed to sign or broadcast the transaction.', err);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (typeof this.wallet.signMessage !== 'function') {
      throw new WalletError('Sodax wallet does not expose signMessage().');
    }
    try {
      return await this.wallet.signMessage(message);
    } catch (err) {
      throw new WalletError('Sodax wallet failed to sign message.', err);
    }
  }

  async disconnect(): Promise<void> {
    if (typeof this.wallet.disconnect === 'function') {
      await this.wallet.disconnect();
    }
  }
}

/** Test-only adapter: stores a fixed address and returns deterministic ids. */
export class InMemoryWalletAdapter implements WalletAdapter {
  public readonly name = 'in-memory';
  private counter = 0;

  constructor(private readonly address: AleoAddress) {}

  getAddress(): Promise<AleoAddress> {
    return Promise.resolve(this.address);
  }

  signAndBroadcast(_call: PreparedProgramCall): Promise<TransactionBroadcastResult> {
    this.counter += 1;
    const id = `at1${'x'.repeat(58)}${this.counter}` as TransactionBroadcastResult['id'];
    return Promise.resolve({ id, accepted: true });
  }

  signMessage(message: string): Promise<string> {
    return Promise.resolve(`mock-sig:${message}`);
  }
}
