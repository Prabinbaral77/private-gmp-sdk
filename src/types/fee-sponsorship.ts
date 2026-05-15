type SdkModule = typeof import('@provablehq/sdk/testnet.js');

export type FeeSponsorshipSdkModule = SdkModule;
export type FeeSponsorshipAccount = InstanceType<SdkModule['Account']>;
export type FeeSponsorshipProgramManager = InstanceType<SdkModule['ProgramManager']>;
export type FeeSponsorshipAuthorization = Awaited<
  ReturnType<FeeSponsorshipProgramManager['buildAuthorization']>
>;
export type FeeSponsorshipProvingRequest = Awaited<
  ReturnType<FeeSponsorshipProgramManager['provingRequest']>
>;

export type FeeSponsorshipNetwork = 'testnet' | 'mainnet';

export type FeeSponsorshipOptions = {
  readonly network?: FeeSponsorshipNetwork;
  readonly host?: string;
  readonly userPrivateKey: string;
  readonly sponsorPrivateKey?: string;
};

export type SponsoredCall = {
  readonly programName: string;
  readonly functionName: string;
  readonly inputs: readonly string[];
  readonly priorityFee?: number;
};

export type ProverOptions = {
  readonly url?: string;
  readonly apiKey?: string;
  readonly consumerId?: string;
  readonly dpsPrivacy?: boolean;
};

export type DelegatedSponsoredCall = SponsoredCall & {
  readonly privateFee?: boolean;
  readonly broadcast?: boolean;
  readonly splitFeeAuthorization?: boolean;
  readonly prover?: ProverOptions;
};

export type OnchainSponsorshipResult = {
  readonly mode: 'onchain';
  readonly transactionId: string;
  readonly executionId: string;
  readonly estimatedBaseFeeMicrocredits: string;
  readonly estimatedBaseFeeCredits: number;
  readonly priorityFeeCredits: number;
  readonly userAddress: string;
  readonly sponsorAddress: string;
};

export type DelegatedSponsorshipResult = {
  readonly mode: 'delegated';
  readonly userAddress: string;
  readonly broadcastRequested: boolean;
  readonly usedFeeMaster: boolean;
  readonly splitFeeAuthorization: boolean;
  readonly response: unknown;
};

export type SponsorshipParty = {
  readonly account: FeeSponsorshipAccount;
  readonly pm: FeeSponsorshipProgramManager;
};

export type BuiltAuthorizations = {
  readonly authorization: FeeSponsorshipAuthorization;
  readonly feeAuthorization: FeeSponsorshipAuthorization;
  readonly executionId: string;
  readonly baseFeeMicrocredits: bigint | number;
  readonly baseFeeCredits: number;
};
