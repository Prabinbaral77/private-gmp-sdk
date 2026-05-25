export type Network = 'testnet' | 'mainnet';

export interface AppConfig {
  readonly port: number;
  readonly network: Network;
  readonly host: string;
  readonly sponsorPrivateKey: string;

  readonly defaultPriorityFeeCredits: number;
  readonly maxBaseFeeCredits: number;
  readonly maxPriorityFeeCredits: number;

  readonly apiKeys: ReadonlySet<string>;
}

export interface FeeAuthorizationRequest {
  readonly executionId: string;
  readonly baseFeeCredits: number;
  readonly priorityFeeCredits?: number;
}

export interface FeeAuthorizationResponse {
  readonly sponsorAddress: string;
  readonly executionId: string;
  readonly baseFeeCredits: number;
  readonly priorityFeeCredits: number;
  readonly feeAuthorization: string;
}

// --- minimal shapes from @provablehq/sdk that this server touches ---

export interface SdkAuthorization {
  toString(): string;
}

export interface SdkAccount {
  privateKey(): unknown;
  address(): { to_string(): string };
}

export interface BuildFeeAuthorizationArgs {
  readonly deploymentOrExecutionId: string;
  readonly baseFeeCredits: number;
  readonly priorityFeeCredits: number;
  readonly privateKey: unknown;
}

export interface SdkProgramManager {
  setAccount(account: SdkAccount): void;
  buildFeeAuthorization(args: BuildFeeAuthorizationArgs): Promise<SdkAuthorization>;
}

export interface ProvableSdkModule {
  Account: new (opts: { privateKey: string }) => SdkAccount;
  ProgramManager: new (
    host: string,
    keyProvider: unknown,
    recordProvider: unknown,
  ) => SdkProgramManager;
  AleoKeyProvider: new () => { useCache(on: boolean): void };
  NetworkRecordProvider: new (account: unknown, client: unknown) => unknown;
  AleoNetworkClient: new (host: string) => unknown;
}

export interface Party {
  readonly sdk: ProvableSdkModule;
  readonly account: SdkAccount;
  readonly pm: SdkProgramManager;
  readonly address: string;
}
