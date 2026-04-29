import { resolveNetwork } from '../config/networks';
import { ProgramService } from '../program/ProgramService';
import { TransactionService } from '../transaction/TransactionService';
import { createLogger } from '../utils/logger';

import type { ProgramAbi, ProgramCallRequest, PreparedProgramCall } from '../types/program';
import type { Logger, LogLevel } from '../utils/logger';
import type { NetworkConfig, NetworkName } from '../types/network';
import type { TransactionId, TransactionReceipt } from '../types/transaction';
import type { WalletAdapter } from '../wallet/WalletAdapter';

export type AleoClientOptions = {
  readonly network: NetworkName | NetworkConfig;
  readonly wallet: WalletAdapter;
  readonly programAbis?: readonly ProgramAbi[];
  readonly logLevel?: LogLevel;
  readonly logger?: Logger;
  readonly fetchImpl?: typeof fetch;
};

/**
 * Top-level entry point for the SDK.
 *
 * Wires together the {@link ProgramService} (encoding & ABI handling), a
 * {@link WalletAdapter} (signing & broadcast — typically Sodax), and a
 * {@link TransactionService} (receipt polling).
 *
 * @example
 * ```ts
 * const client = new AleoClient({
 *   network: 'testnet',
 *   wallet: new SodaxWalletAdapter(sodaxWallet),
 * });
 *
 * const receipt = await client.call({
 *   programId: 'credits.aleo',
 *   functionName: 'transfer_public',
 *   inputs: ['aleo1abc...xyz', 1_000_000n],
 * });
 * ```
 */
export class AleoClient {
  private readonly logger: Logger;
  private readonly network: NetworkConfig;
  private readonly wallet: WalletAdapter;
  private readonly programs: ProgramService;
  private readonly transactions: TransactionService;

  constructor(options: AleoClientOptions) {
    this.logger =
      options.logger ?? createLogger({ ...(options.logLevel ? { level: options.logLevel } : {}) });
    this.network = resolveNetwork(options.network);
    this.wallet = options.wallet;
    this.programs = new ProgramService();
    for (const abi of options.programAbis ?? []) {
      this.programs.registerAbi(abi);
    }
    this.transactions = new TransactionService(this.network, {
      logger: this.logger.child('tx'),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }

  /** Pure data preparation. No network IO, no signing — useful in dry-runs / tests. */
  prepare(request: ProgramCallRequest): PreparedProgramCall {
    return this.programs.prepare(request);
  }

  /** Prepare + sign + broadcast, then wait for the network ack. */
  async submit(request: ProgramCallRequest): Promise<TransactionId> {
    const prepared = this.prepare(request);
    this.logger.info('submit', {
      program: prepared.programId,
      function: prepared.functionName,
      inputs: prepared.encodedInputs.length,
    });
    const ack = await this.wallet.signAndBroadcast(prepared);
    if (!ack.accepted) {
      this.logger.warn('wallet did not accept the transaction', { id: ack.id });
    }
    return ack.id;
  }

  /** Submit and poll the RPC until the transaction is finalized or fails. */
  async call(request: ProgramCallRequest): Promise<TransactionReceipt> {
    const id = await this.submit(request);
    return this.transactions.waitFor(id);
  }

  registerAbi(abi: ProgramAbi): void {
    this.programs.registerAbi(abi);
  }

  get networkConfig(): NetworkConfig {
    return this.network;
  }
}
