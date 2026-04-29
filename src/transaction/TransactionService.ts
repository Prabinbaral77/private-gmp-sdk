import { NetworkError, TransactionError } from '../utils/errors';

import type { Logger } from '../utils/logger';
import type { NetworkConfig } from '../types/network';
import type { TransactionId, TransactionReceipt } from '../types/transaction';

export type TransactionServiceOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly pollIntervalMs?: number;
  readonly maxAttempts?: number;
  readonly logger?: Logger;
};

const DEFAULT_POLL_MS = 2_500;
const DEFAULT_MAX_ATTEMPTS = 60;

/**
 * Reads transaction state from the configured Aleo RPC.
 *
 * The Aleo public API exposes `/transaction/{id}` for receipts. This service
 * is intentionally read-only: broadcasts go through the {@link WalletAdapter}
 * because they require signing.
 */
export class TransactionService {
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly logger: Logger | undefined;

  constructor(
    private readonly network: NetworkConfig,
    options: TransactionServiceOptions = {},
  ) {
    this.fetchImpl =
      options.fetchImpl ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined!);
    if (!this.fetchImpl) {
      throw new NetworkError('No fetch implementation available. Pass options.fetchImpl.');
    }
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.logger = options.logger;
  }

  async getReceipt(id: TransactionId): Promise<TransactionReceipt | null> {
    const url = `${this.network.rpcUrl.replace(/\/$/, '')}/transaction/${id}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'GET' });
    } catch (err) {
      throw new NetworkError(`Failed to reach Aleo RPC at ${url}.`, err);
    }
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new NetworkError(`Aleo RPC ${url} returned ${res.status}.`);
    }
    const body = (await res.json()) as Partial<TransactionReceipt> & { id?: string };
    if (!body.id) {
      throw new NetworkError('Aleo RPC response missing transaction id.');
    }
    return body as TransactionReceipt;
  }

  /**
   * Poll until the transaction reaches a terminal status or attempts run out.
   *
   * Throws {@link TransactionError} on `failed` / `rejected`. Returns the
   * receipt on `accepted` / `finalized`.
   */
  async waitFor(id: TransactionId): Promise<TransactionReceipt> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const receipt = await this.getReceipt(id);
      if (receipt) {
        this.logger?.debug(`tx ${id} status=${receipt.status}`);
        if (receipt.status === 'accepted' || receipt.status === 'finalized') {
          return receipt;
        }
        if (receipt.status === 'rejected' || receipt.status === 'failed') {
          throw new TransactionError(
            `Transaction ${id} ${receipt.status}: ${receipt.errorMessage ?? 'no message'}`,
          );
        }
      }
      await delay(this.pollIntervalMs);
    }
    throw new TransactionError(
      `Transaction ${id} did not reach a terminal state after ${this.maxAttempts} attempts.`,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
