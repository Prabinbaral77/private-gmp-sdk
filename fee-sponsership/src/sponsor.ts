import type {
  AppConfig,
  FeeAuthorizationRequest,
  FeeAuthorizationResponse,
  Party,
  ProvableSdkModule,
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

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class FeeSponsor {
  private readonly config: AppConfig;
  private partyPromise: Promise<Party> | undefined;

  constructor(config: AppConfig) {
    this.config = config;
  }

  authenticate(apiKey: string | undefined): void {
    if (this.config.apiKeys.size === 0) {
      throw new AuthError('Server has no API keys configured; all requests are rejected');
    }
    if (!apiKey) {
      throw new AuthError('Missing API key (expected Authorization: Bearer <key> or x-api-key)');
    }
    if (!this.config.apiKeys.has(apiKey)) {
      throw new AuthError('Invalid API key');
    }
  }

  async signFee(req: FeeAuthorizationRequest): Promise<FeeAuthorizationResponse> {
    this.validateRequest(req);

    const baseFeeCredits = req.baseFeeCredits;
    if (baseFeeCredits > this.config.maxBaseFeeCredits) {
      throw new PolicyError(
        `baseFeeCredits ${baseFeeCredits} exceeds cap ${this.config.maxBaseFeeCredits}`,
      );
    }
    const priorityFeeCredits = req.priorityFeeCredits ?? this.config.defaultPriorityFeeCredits;
    if (priorityFeeCredits > this.config.maxPriorityFeeCredits) {
      throw new PolicyError(
        `priorityFeeCredits ${priorityFeeCredits} exceeds cap ${this.config.maxPriorityFeeCredits}`,
      );
    }

    const { account, pm, address } = await this.getParty();

    const feeAuthorization = await pm.buildFeeAuthorization({
      deploymentOrExecutionId: req.executionId,
      baseFeeCredits,
      priorityFeeCredits,
      privateKey: account.privateKey(),
    });

    return {
      sponsorAddress: address,
      executionId: req.executionId,
      baseFeeCredits,
      priorityFeeCredits,
      feeAuthorization: feeAuthorization.toString(),
    };
  }

  private validateRequest(req: FeeAuthorizationRequest): void {
    if (typeof req.executionId !== 'string' || req.executionId.length === 0) {
      throw new ValidationError('executionId must be a non-empty string');
    }
    if (
      typeof req.baseFeeCredits !== 'number' ||
      !Number.isFinite(req.baseFeeCredits) ||
      req.baseFeeCredits < 0
    ) {
      throw new ValidationError('baseFeeCredits must be a non-negative number');
    }
    if (req.priorityFeeCredits !== undefined) {
      const pf = req.priorityFeeCredits;
      if (typeof pf !== 'number' || !Number.isFinite(pf) || pf < 0) {
        throw new ValidationError('priorityFeeCredits must be a non-negative number');
      }
    }
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
