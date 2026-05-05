// import { NetworkError } from '../utils/errors';

// type SdkModule = typeof import('@provablehq/sdk/testnet.js');

// export type ScannerNetwork = 'mainnet' | 'testnet';

// export type ScanFilter = {
//   readonly programs: readonly string[];
//   readonly records?: readonly string[];
//   readonly startBlock?: number;
//   readonly endBlock?: number;
//   readonly limit?: number;
// };

// export type ScannedRecord = {
//   program_name?: string;
//   record_name?: string;
//   block_height?: number;
//   tag?: string;
//   record_ciphertext?: string;
//   spent?: boolean;
//   [key: string]: unknown;
// };

// export type ScanResult = {
//   mode: 'hosted' | 'sdk';
//   records: ScannedRecord[];
//   count: number;
//   registration?: { uuid: string; status: unknown };
// };

// export type RecordScannerOptions = {
//   readonly network: ScannerNetwork;
//   readonly privateKey: string;
//   /** Aleo node RPC (used by the SDK approach). */
//   readonly host?: string;
//   /** Hosted indexer base URL (used by the hosted approach). */
//   readonly scannerUrl?: string;
//   readonly apiKey?: string;
//   readonly consumerId?: string;
//   readonly fetchImpl?: typeof fetch;
// };

// const DEFAULT_SCANNER_URL = 'https://api.provable.com';
// const DEFAULT_HOST = 'https://api.provable.com/v2';
// const DEFAULT_LIMIT = 20;

// /**
//  * Scan owned Aleo records via either the hosted indexer or the local SDK.
//  *
//  * The hosted mode talks to the Provable indexer and decrypts ciphertexts on
//  * the client. If `apiKey`/`consumerId` are not supplied, a consumer is
//  * auto-registered with a unique username.
//  *
//  * The SDK mode uses `NetworkRecordProvider.findRecords` against the configured
//  * Aleo RPC host.
//  */
// export class RecordScannerService {
//   private sdkPromise: Promise<SdkModule> | undefined;

//   constructor(private readonly options: RecordScannerOptions) {}

//   async hosted(filter: ScanFilter): Promise<ScanResult> {
//     const sdk = await this.loadSdk();
//     const { Account, RecordScanner } = sdk;
//     const account = new Account({ privateKey: this.options.privateKey });
//     const scannerUrl = this.options.scannerUrl ?? DEFAULT_SCANNER_URL;
//     const { apiKey, consumerId } = await this.resolveCredentials(scannerUrl);

//     const scanner = new RecordScanner({
//       url: scannerUrl,
//       account,
//       decryptEnabled: true,
//       autoReRegister: true,
//       apiKey,
//       consumerId,
//     });

//     const reg = await scanner.registerEncrypted(account.viewKey(), filter.startBlock ?? 0);
//     if (!reg.ok) throw scannerError('register view key', reg);

//     const limit = filter.limit ?? DEFAULT_LIMIT;
//     const owned = await scanner.owned({
//       uuid: reg.data.uuid,
//       unspent: true,
//       decrypt: true,
//       response_filter: {
//         block_height: true,
//         program_name: true,
//         record_name: true,
//         tag: true,
//         record_ciphertext: true,
//         spent: true,
//       },
//       filter: {
//         programs: [...filter.programs],
//         ...(filter.records ? { records: [...filter.records] } : {}),
//         results_per_page: limit,
//         page: 0,
//       },
//     });
//     if (!owned.ok) throw scannerError('fetch owned records', owned);

//     const records = filterRecords(owned.data, filter.programs, filter.records);
//     return {
//       mode: 'hosted',
//       records: records.slice(0, limit),
//       count: records.length,
//       registration: { uuid: reg.data.uuid, status: reg.data.status ?? null },
//     };
//   }

//   async sdk(filter: ScanFilter): Promise<ScanResult> {
//     const sdk = await this.loadSdk();
//     const { Account, AleoNetworkClient, NetworkRecordProvider } = sdk;
//     const account = new Account({ privateKey: this.options.privateKey });
//     const networkClient = new AleoNetworkClient(this.options.host ?? DEFAULT_HOST);
//     const provider = new NetworkRecordProvider(account, networkClient);

//     const found = (await provider.findRecords({
//       unspent: false,
//       startHeight: filter.startBlock ?? 0,
//       endHeight: filter.endBlock,
//       programs: [...filter.programs],
//     } as Parameters<typeof provider.findRecords>[0])) as ScannedRecord[];

//     const records = filterRecords(found, filter.programs, filter.records);
//     const limit = filter.limit ?? DEFAULT_LIMIT;
//     return { mode: 'sdk', records: records.slice(0, limit), count: records.length };
//   }

//   private loadSdk(): Promise<SdkModule> {
//     if (!this.sdkPromise) {
//       const mod = this.options.network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
//       this.sdkPromise = import(`@provablehq/sdk/${mod}`) as Promise<SdkModule>;
//     }
//     return this.sdkPromise;
//   }

//   private async resolveCredentials(
//     scannerUrl: string,
//   ): Promise<{ apiKey: string; consumerId: string }> {
//     const { apiKey, consumerId } = this.options;
//     if (apiKey && consumerId) return { apiKey, consumerId };
//     const created = await this.createConsumer(scannerUrl);
//     return {
//       apiKey: apiKey ?? created.apiKey,
//       consumerId: consumerId ?? created.consumerId,
//     };
//   }

//   private async createConsumer(
//     scannerUrl: string,
//   ): Promise<{ apiKey: string; consumerId: string }> {
//     const fetchImpl =
//       this.options.fetchImpl ??
//       (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
//     if (!fetchImpl) {
//       throw new NetworkError('No fetch implementation available. Pass options.fetchImpl.');
//     }
//     const url = `${scannerUrl.replace(/\/$/, '')}/consumers`;
//     const res = await fetchImpl(url, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
//       body: JSON.stringify({ username: `user${Date.now()}` }),
//     });
//     if (!res.ok) {
//       const body = await res.text().catch(() => '');
//       throw new NetworkError(`Failed to create consumer: status=${res.status}, body=${body}`);
//     }
//     const data = (await res.json()) as { consumer?: { id?: string }; key?: string };
//     if (!data.consumer?.id || !data.key) {
//       throw new NetworkError(`Invalid consumer response: ${JSON.stringify(data)}`);
//     }
//     return { apiKey: data.key, consumerId: data.consumer.id };
//   }
// }

// function filterRecords(
//   records: readonly ScannedRecord[],
//   programs: readonly string[],
//   recordNames?: readonly string[],
// ): ScannedRecord[] {
//   const programSet = new Set(programs);
//   const recordSet = recordNames?.length ? new Set(recordNames) : undefined;
//   return records.filter((r) => {
//     if (!programSet.has(r.program_name ?? '')) return false;
//     if (recordSet && !recordSet.has(r.record_name ?? '')) return false;
//     return true;
//   });
// }

// function scannerError(context: string, result: unknown): NetworkError {
//   const r = (result ?? {}) as { status?: number; error?: { message?: string } };
//   return new NetworkError(
//     `Failed to ${context}: status=${r.status ?? 'unknown'}, message=${r.error?.message ?? 'No message'}`,
//   );
// }
