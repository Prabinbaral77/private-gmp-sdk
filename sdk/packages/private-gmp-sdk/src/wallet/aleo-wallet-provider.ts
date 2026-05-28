import type { SdkModule } from '@/types/scanner';
import type { AleoNetwork } from '@/types/derivation';
import type {
  AleoDelegateConfig,
  AleoExecuteOptions,
  AleoExecutionResult,
  AleoTransactionReceipt,
  AleoWaitForReceiptOptions,
  AleoWalletProviderOptions,
} from '@/types/wallet';
import { TransactionError, ValidationError, WalletError } from '@/utils/errors';

const DEFAULT_PRIORITY_FEE = 0;
const DEFAULT_PRIVATE_FEE = false;
const DEFAULT_CHECK_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_DPS_PRIVACY = true;

type InitializedState = {
  readonly sdk: SdkModule;
  readonly account: InstanceType<SdkModule['Account']>;
  readonly networkClient: InstanceType<SdkModule['AleoNetworkClient']>;
  readonly programManager: InstanceType<SdkModule['ProgramManager']>;
};

/**
 * Signs and broadcasts Aleo transitions with a private key.
 *
 * The provider lazy-loads `@provablehq/sdk` for the configured network on first
 * use, then reuses the loaded module, account, and `ProgramManager` for every
 * subsequent call. See `wallet/index.ts` for the public re-exports.
 */
export class AleoWalletProvider {
  private readonly options: AleoWalletProviderOptions;
  private initPromise: Promise<InitializedState> | undefined;

  constructor(options: AleoWalletProviderOptions) {
    if (options.network !== 'mainnet' && options.network !== 'testnet') {
      throw new ValidationError(`Unsupported Aleo network '${String(options.network)}'.`);
    }
    if (!options.privateKey) throw new ValidationError('privateKey is required.');
    if (!options.rpcUrl) throw new ValidationError('rpcUrl is required.');
    this.options = options;
  }

  async getAddress(): Promise<string> {
    const { account } = await this.ensureInitialized();
    return account.address().to_string();
  }

  async execute(options: AleoExecuteOptions): Promise<AleoExecutionResult> {
    const { programManager, networkClient } = await this.ensureInitialized();
    const priorityFee = options.priorityFee ?? DEFAULT_PRIORITY_FEE;
    const privateFee = options.privateFee ?? DEFAULT_PRIVATE_FEE;
    const delegate = options.delegate ?? this.options.delegate;

    try {
      if (delegate) {
        const provingRequest = await programManager.provingRequest({
          programName: options.programName,
          functionName: options.functionName,
          inputs: [...options.inputs],
          priorityFee,
          privateFee,
          broadcast: true,
        });

        const submitParams = buildDelegatedProvingParams(provingRequest, delegate);
        const response = await networkClient.submitProvingRequest(submitParams);

        const broadcastStatus = response.broadcast_result.status;
        if (broadcastStatus === 'Rejected' || broadcastStatus === 'Failed') {
          const message =
            'message' in response.broadcast_result && response.broadcast_result.message
              ? response.broadcast_result.message
              : broadcastStatus;
          throw new TransactionError(
            `Delegated prover broadcast ${broadcastStatus.toLowerCase()}: ${message}`,
          );
        }
        return { transactionId: response.transaction.id };
      }

      const transactionId = await programManager.execute({
        programName: options.programName,
        functionName: options.functionName,
        inputs: [...options.inputs],
        priorityFee,
        privateFee,
      });
      return { transactionId };
    } catch (err) {
      if (err instanceof TransactionError) throw err;
      throw new TransactionError(
        `Failed to execute ${options.programName}/${options.functionName}: ${errorMessage(err)}`,
        err,
      );
    }
  }

  async waitForTransactionReceipt(
    transactionId: string,
    options: AleoWaitForReceiptOptions = {},
  ): Promise<AleoTransactionReceipt> {
    const { networkClient } = await this.ensureInitialized();
    const checkInterval = options.checkInterval ?? DEFAULT_CHECK_INTERVAL_MS;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

    try {
      const confirmed = await networkClient.waitForTransactionConfirmation(
        transactionId,
        checkInterval,
        timeout,
      );
      return {
        transactionId,
        status: confirmed.status,
        type: confirmed.type,
        index: confirmed.index,
        confirmedAt: new Date(),
      };
    } catch (err) {
      throw mapReceiptError(transactionId, timeout, err);
    }
  }

  async executeAndWait(
    options: AleoExecuteOptions,
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    const result = await this.execute(options);
    const receipt = await this.waitForTransactionReceipt(result.transactionId, receiptOptions);
    return { result, receipt };
  }

  private ensureInitialized(): Promise<InitializedState> {
    if (!this.initPromise) {
      this.initPromise = this.initialize().catch((err) => {
        // Reset so a transient failure (e.g. WASM load error) can be retried.
        this.initPromise = undefined;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async initialize(): Promise<InitializedState> {
    const sdk = await loadSdk(this.options.network);
    const { Account, AleoNetworkClient, ProgramManager, AleoKeyProvider, NetworkRecordProvider } = sdk;

    const account = new Account({ privateKey: this.options.privateKey });
    const networkClient = new AleoNetworkClient(this.options.rpcUrl);

    const keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);

    const recordProvider = new NetworkRecordProvider(account, networkClient);
    const programManager = new ProgramManager(this.options.rpcUrl, keyProvider, recordProvider);
    programManager.setAccount(account);

    return { sdk, account, networkClient, programManager };
  }
}

async function loadSdk(network: AleoNetwork): Promise<SdkModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as SdkModule;
  } catch (err) {
    throw new WalletError(
      `AleoWalletProvider requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type ProvingRequestInstance = Awaited<
  ReturnType<InstanceType<SdkModule['ProgramManager']>['provingRequest']>
>;

type DelegatedProvingParams = Parameters<
  InstanceType<SdkModule['AleoNetworkClient']>['submitProvingRequest']
>[0];

function buildDelegatedProvingParams(
  provingRequest: ProvingRequestInstance,
  delegate: AleoDelegateConfig,
): DelegatedProvingParams {
  return {
    provingRequest,
    url: delegate.url,
    dpsPrivacy: delegate.dpsPrivacy ?? DEFAULT_DPS_PRIVACY,
    ...(delegate.apiKey !== undefined && { apiKey: delegate.apiKey }),
    ...(delegate.consumerId !== undefined && { consumerId: delegate.consumerId }),
  };
}

function mapReceiptError(transactionId: string, timeout: number, err: unknown): TransactionError {
  const message = errorMessage(err);
  if (message.includes('timeout') || message.includes('did not appear')) {
    return new TransactionError(
      `Transaction ${transactionId} did not confirm within ${timeout}ms. It may still be pending — check status manually.`,
      err,
    );
  }
  if (message.includes('Malformed') || message.includes('Invalid URL')) {
    return new TransactionError(`Invalid transaction ID format: ${transactionId}.`, err);
  }
  if (message.includes('rejected')) {
    return new TransactionError(
      `Transaction ${transactionId} was rejected by the network. Check fee payer balance and inputs.`,
      err,
    );
  }
  return new TransactionError(
    `Failed to confirm transaction ${transactionId}: ${message}`,
    err,
  );
}
