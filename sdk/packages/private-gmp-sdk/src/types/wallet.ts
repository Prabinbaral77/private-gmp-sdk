/**
 * Public types for the Aleo wallet provider.
 *
 * Implementation lives in {@link ../wallet}; this file holds only the shapes
 * consumers see.
 */

import type { AleoNetwork } from './derivation';

/**
 * Delegated proving config. When supplied, `execute()` builds a `ProvingRequest`
 * signed by the wallet (both program and fee auth) and ships it to a remote
 * prover instead of generating the proof locally. The fee is still paid from
 * the wallet's own balance — there is no sponsor in this flow.
 */
export interface AleoDelegateConfig {
  /** Delegated proving service URL — e.g. `https://api.provable.com/prove/testnet`. */
  readonly url: string;
  readonly apiKey?: string;
  readonly consumerId?: string;
  /** Encrypt the request to the prover (DPS privacy). Defaults to true. */
  readonly dpsPrivacy?: boolean;
}

export interface AleoWalletProviderOptions {
  readonly network: AleoNetwork;
  /** Private key used to sign and pay for transactions (e.g. `APrivateKey1zk...`). */
  readonly privateKey: string;
  /** Aleo node RPC base URL — e.g. `https://api.explorer.provable.com/v1`. */
  readonly rpcUrl: string;
  /** Default delegated-prover config. A per-call `AleoExecuteOptions#delegate` overrides this. */
  readonly delegate?: AleoDelegateConfig;
}

export interface AleoExecuteOptions {
  readonly programName: string;
  readonly functionName: string;
  readonly inputs: readonly string[];
  /** Priority fee in microcredits — defaults to 0 (base fee only). */
  readonly priorityFee?: number;
  /** When true, pays the fee from a private record. Defaults to false (public balance). */
  readonly privateFee?: boolean;
  /** Use a delegated prover for this call. Overrides the provider's default. */
  readonly delegate?: AleoDelegateConfig;
}

export interface AleoExecutionResult {
  readonly transactionId: string;
}

export interface AleoWaitForReceiptOptions {
  /** Polling interval in milliseconds. Defaults to 2000. */
  readonly checkInterval?: number;
  /** Maximum time to wait for confirmation in milliseconds. Defaults to 60000. */
  readonly timeout?: number;
}

export interface AleoTransactionReceipt {
  readonly transactionId: string;
  readonly status: string;
  readonly type: string;
  readonly index: bigint;
  readonly confirmedAt: Date;
}
