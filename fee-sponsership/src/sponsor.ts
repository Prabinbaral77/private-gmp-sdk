import type {
  AppConfig,
  CheckedTransition,
  Party,
  ProvableSdkModule,
  SdkAuthorization,
  SponsorRequest,
  SponsorResponse,
} from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

export class FeeSponsor {
  private readonly config: AppConfig;
  private partyPromise: Promise<Party> | undefined;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async sponsor(req: SponsorRequest): Promise<SponsorResponse> {
    this.validateRequest(req);

    const { sdk, account, pm, address } = await this.getParty();

    let authorization: SdkAuthorization;
    try {
      authorization = sdk.Authorization.fromString(req.authorization);
    } catch (err) {
      throw new ValidationError(
        `Failed to parse authorization: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

   
    const transitions = authorization.transitions().map<CheckedTransition>((t) => ({
      programId: t.programId(),
      functionName: t.functionName(),
    }));
    if (transitions.length === 0) {
      throw new ValidationError('Authorization has no transitions');
    }

    const entryFunctionName = authorization.functionName();
    const entryPoint =
      [...transitions].reverse().find((t) => t.functionName === entryFunctionName) ??
      transitions[transitions.length - 1];

    if (!this.isAllowed(entryPoint.programId, entryPoint.functionName)) {
      throw new PolicyError(
        `Not allowed: ${entryPoint.programId}/${entryPoint.functionName}`,
      );
    }

    const executionId = authorization.toExecutionId().toString();

    const baseFeeMicrocredits = await pm.estimateFeeForAuthorization({
      programName: entryPoint.programId,
      authorization,
    });
    const baseFeeCredits = Number(baseFeeMicrocredits) / 1_000_000;
    if (baseFeeCredits > this.config.maxBaseFeeCredits) {
      throw new PolicyError(
        `Estimated base fee ${baseFeeCredits} exceeds cap ${this.config.maxBaseFeeCredits}`,
      );
    }

    const priorityFeeCredits = req.priorityFeeCredits ?? this.config.defaultPriorityFeeCredits;
    if (priorityFeeCredits > this.config.maxPriorityFeeCredits) {
      throw new PolicyError(
        `Priority fee ${priorityFeeCredits} exceeds cap ${this.config.maxPriorityFeeCredits}`,
      );
    }

    const feeAuthorization = await pm.buildFeeAuthorization({
      deploymentOrExecutionId: executionId,
      baseFeeCredits,
      priorityFeeCredits,
      privateKey: account.privateKey(),
    });

    const broadcast = req.broadcast ?? true;
    const provingRequest = sdk.ProvingRequest.new(authorization, feeAuthorization, broadcast);

    const submitArgs: {
      provingRequest: typeof provingRequest;
      url?: string;
      apiKey?: string;
      consumerId?: string;
      dpsPrivacy?: boolean;
    } = { provingRequest };
    if (this.config.proverUrl !== undefined) submitArgs.url = this.config.proverUrl;
    if (this.config.proverApiKey !== undefined) submitArgs.apiKey = this.config.proverApiKey;
    if (this.config.proverConsumerId !== undefined) {
      submitArgs.consumerId = this.config.proverConsumerId;
    }
    submitArgs.dpsPrivacy = this.config.proverDpsPrivacy;

    const proving = await pm.networkClient.submitProvingRequest(submitArgs);

    return {
      sponsorAddress: address,
      executionId,
      entryPoint,
      transitions,
      estimatedBaseFeeCredits: baseFeeCredits,
      priorityFeeCredits,
      broadcastRequested: broadcast,
      proving,
    };
  }

  private validateRequest(req: SponsorRequest): void {
    if (typeof req.authorization !== 'string' || req.authorization.length === 0) {
      throw new ValidationError('authorization must be a non-empty string');
    }
    if (req.priorityFeeCredits !== undefined) {
      const pf = req.priorityFeeCredits;
      if (typeof pf !== 'number' || !Number.isFinite(pf) || pf < 0) {
        throw new ValidationError('priorityFeeCredits must be a non-negative number');
      }
    }
    if (req.broadcast !== undefined && typeof req.broadcast !== 'boolean') {
      throw new ValidationError('broadcast must be a boolean');
    }
  }

  private isAllowed(programId: string, functionName: string): boolean {
    const allowed = this.config.allowlist[programId];
    return allowed?.has(functionName) ?? false;
  }

  private getParty(): Promise<Party> {
    if (!this.partyPromise) {
      this.partyPromise = this.makeParty().catch((err) => {
        this.partyPromise = undefined;
        throw err;
      });
    }
    return this.partyPromise;
  }

  private async makeParty(): Promise<Party> {
    const sub = this.config.network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
    const sdk = (await import(`@provablehq/sdk/${sub}`)) as ProvableSdkModule;

    const account = new sdk.Account({ privateKey: this.config.sponsorPrivateKey });
    const networkClient = new sdk.AleoNetworkClient(this.config.host);
    const keyProvider = new sdk.AleoKeyProvider();
    keyProvider.useCache(true);
    const recordProvider = new sdk.NetworkRecordProvider(account, networkClient);
    const pm = new sdk.ProgramManager(this.config.host, keyProvider, recordProvider);
    pm.setAccount(account);

    return { sdk, account, pm, address: account.address().to_string() };
  }
}
