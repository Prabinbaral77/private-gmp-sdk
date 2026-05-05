import { RecordScannerOptions, ScanFilter, ScannedRecord, ScanResult, SdkModule } from '@/types/scanner';
import { filterRecords } from './filter-record';
import { resolveCredentials } from './resolve-credentials';
import { scannerError } from './error';
import { DEFAULT_HOST, DEFAULT_LIMIT, DEFAULT_SCANNER_URL } from '@/constants/scanner';

/**
 * Scan owned Aleo records via either the hosted indexer or the local SDK.
 *
 * The hosted mode talks to the Provable indexer and decrypts ciphertexts on
 * the client. If `apiKey`/`consumerId` are not supplied, a consumer is
 * auto-registered with a unique username.
 *
 * The SDK mode uses `NetworkRecordProvider.findRecords` against the configured
 * Aleo RPC host.
 */
export class RecordScannerService {
  private sdkPromise: Promise<SdkModule> | undefined;

  constructor(private readonly options: RecordScannerOptions) {}

  async getCredentials(): Promise<{ apiKey: string; consumerId: string }> {
    const {Account} = await this.loadSdk();
    const scannerUrl = this.options.scannerUrl ?? DEFAULT_SCANNER_URL;
    return await resolveCredentials(scannerUrl, this.options, new Account({privateKey: this.options.privateKey}));
  }

  async hosted(filter: ScanFilter): Promise<ScanResult> {
    const sdk = await this.loadSdk();
    const { Account, RecordScanner } = sdk;
    const account = new Account({ privateKey: this.options.privateKey });
    const scannerUrl = this.options.scannerUrl ?? DEFAULT_SCANNER_URL;

    const scanner = new RecordScanner({
      url: scannerUrl,
      account,
      decryptEnabled: true,
      autoReRegister: true,
      apiKey: filter.apiKey,
      consumerId: filter.consumerId,
    });

    const reg = await scanner.registerEncrypted(account.viewKey(), filter.startBlock ?? 0);
    if (!reg.ok) throw scannerError('register view key', reg);

    const limit = filter.limit ?? DEFAULT_LIMIT;
    const owned = await scanner.owned({
      uuid: reg.data.uuid,
      unspent: true,
      decrypt: true,
      response_filter: {
        block_height: true,
        program_name: true,
        record_name: true,
        tag: true,
        record_ciphertext: true,
        spent: true,
      },
      filter: {
        programs: [...filter.programs],
        ...(filter.records ? { records: [...filter.records] } : {}),
        results_per_page: limit,
        page: 0,
      },
    });
    if (!owned.ok) throw scannerError('fetch owned records', owned);

    const records = filterRecords(owned.data, filter.programs, filter.records);
    return {
      mode: 'hosted',
      records: records.slice(0, limit),
      count: records.length,
      registration: { uuid: reg.data.uuid, status: reg.data.status ?? null },
    };
  }

  async sdk(filter: ScanFilter): Promise<ScanResult> {
    const sdk = await this.loadSdk();
    const { Account, RecordScanner } = sdk;
    const account = new Account({ privateKey: this.options.privateKey });
    const recordScanner = new RecordScanner({
      url: this.options.host ?? DEFAULT_HOST,
    });
    recordScanner.setApiKey(filter.apiKey);
    recordScanner.setConsumerId(filter.consumerId);
    // Encrypted registration (recommended)
    const regResult = await recordScanner.registerEncrypted(account.viewKey(), 0);
    if (!regResult.ok) {
      throw new Error(regResult.error?.message ?? `Registration failed: ${regResult.status}`);
    }
    const uuid = regResult.data.uuid;


    const found = (await recordScanner.findRecords({
      uuid,
      unspent: false,
      startHeight: filter.startBlock ?? 0,
      endHeight: filter.endBlock,
      programs: [...filter.programs],
    } as Parameters<typeof recordScanner.findRecords>[0])) as ScannedRecord[];
    console.log(`SDK found ${found.length} records matching programs ${filter.programs.join(',')}`);


    const records = filterRecords(found, filter.programs, filter.records);
    const limit = filter.limit ?? DEFAULT_LIMIT;
    return { mode: 'sdk', records: records.slice(0, limit), count: records.length };
  }

  private loadSdk(): Promise<SdkModule> {
    if (!this.sdkPromise) {
      const mod = this.options.network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
      this.sdkPromise = import(`@provablehq/sdk/${mod}`) as Promise<SdkModule>;
    }
    return this.sdkPromise;
  }
}
