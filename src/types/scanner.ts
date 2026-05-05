export type SdkModule = typeof import('@provablehq/sdk/testnet.js');

export type ScannerNetwork = 'mainnet' | 'testnet';

export type ScanFilter = {
  readonly programs: readonly string[];
  readonly records?: readonly string[];
  readonly startBlock?: number;
  readonly endBlock?: number;
  readonly limit?: number;
  readonly apiKey: string;
  readonly consumerId: string;
};

export type ScannedRecord = {
  program_name?: string;
  record_name?: string;
  block_height?: number;
  tag?: string;
  record_ciphertext?: string;
  spent?: boolean;
  [key: string]: unknown;
};

export type ScanResult = {
  mode: 'hosted' | 'sdk';
  records: ScannedRecord[];
  count: number;
  registration?: { uuid: string; status: unknown };
};

export type RecordScannerOptions = {
  readonly network: ScannerNetwork;
  readonly privateKey: string;
  /** Aleo node RPC (used by the SDK approach). */
  readonly host?: string;
  /** Hosted indexer base URL (used by the hosted approach). */
  readonly scannerUrl?: string;
  readonly apiKey?: string;
  readonly consumerId?: string;
  readonly fetchImpl?: typeof fetch;
};