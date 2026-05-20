export type Network = 'testnet' | 'mainnet';

export type Allowlist = Readonly<Record<string, ReadonlySet<string>>>;

export interface AppConfig {
  readonly port: number;
  readonly network: Network;
  readonly host: string;
  readonly sponsorPrivateKey: string;

  readonly proverUrl: string | undefined;
  readonly proverApiKey: string | undefined;
  readonly proverConsumerId: string | undefined;
  readonly proverDpsPrivacy: boolean;

  readonly defaultPriorityFeeCredits: number;
  readonly maxBaseFeeCredits: number;
  readonly maxPriorityFeeCredits: number;

  readonly allowlist: Allowlist;
}

export interface SponsorRequest {
  readonly authorization: string;
  readonly priorityFeeCredits?: number;
  readonly broadcast?: boolean;
}

export interface CheckedTransition {
  readonly programId: string;
  readonly functionName: string;
}

export interface SponsorResponse {
  readonly sponsorAddress: string;
  readonly executionId: string;
  readonly entryPoint: CheckedTransition;
  readonly transitions: readonly CheckedTransition[];
  readonly estimatedBaseFeeCredits: number;
  readonly priorityFeeCredits: number;
  readonly broadcastRequested: boolean;
  readonly proving: unknown;
}

// --- minimal shapes from @provablehq/sdk that this server touches ---

export interface SdkAuthorization {
  toString(): string;
  toExecutionId(): { toString(): string };
  functionName(): string;
  transitions(): SdkTransition[];
}

export interface SdkTransition {
  programId(): string;
  functionName(): string;
}

export interface SdkProvingRequest {
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

export interface EstimateFeeArgs {
  readonly programName: string;
  readonly authorization: SdkAuthorization;
}

export interface SubmitProvingRequestArgs {
  readonly provingRequest: SdkProvingRequest;
  readonly url?: string;
  readonly apiKey?: string;
  readonly consumerId?: string;
  readonly dpsPrivacy?: boolean;
}

export interface SdkNetworkClient {
  submitProvingRequest(args: SubmitProvingRequestArgs): Promise<unknown>;
}

export interface SdkProgramManager {
  readonly networkClient: SdkNetworkClient;
  setAccount(account: SdkAccount): void;
  estimateFeeForAuthorization(args: EstimateFeeArgs): Promise<bigint>;
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
  AleoNetworkClient: new (host: string) => SdkNetworkClient;
  Authorization: { fromString(s: string): SdkAuthorization };
  ProvingRequest: {
    new: (
      authorization: SdkAuthorization,
      feeAuthorization: SdkAuthorization | null | undefined,
      broadcast: boolean,
    ) => SdkProvingRequest;
  };
}

export interface Party {
  readonly sdk: ProvableSdkModule;
  readonly account: SdkAccount;
  readonly pm: SdkProgramManager;
  readonly address: string;
}
