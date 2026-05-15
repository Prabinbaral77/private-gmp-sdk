import { ValidationError, WalletError } from '../utils/errors';

import type {
  BuiltAuthorizations,
  DelegatedSponsoredCall,
  DelegatedSponsorshipResult,
  FeeSponsorshipNetwork,
  FeeSponsorshipOptions,
  FeeSponsorshipProvingRequest,
  FeeSponsorshipSdkModule,
  OnchainSponsorshipResult,
  SponsoredCall,
  SponsorshipParty,
} from '../types/fee-sponsorship';

const DEFAULT_HOST = 'https://api.provable.com/v2';

/**
 * Builds and submits Aleo transactions whose fees are paid by a sponsor.
 *
 * Two modes:
 * - `submitOnchain`: sponsor builds the fee authorization and submits the tx.
 * - `submitDelegated`: tx is delegated to a remote prover (with optional
 *   sponsor-signed fee authorization).
 */
export class FeeSponsorshipService {
  private readonly network: FeeSponsorshipNetwork;
  private readonly host: string;
  private readonly userPrivateKey: string;
  private readonly sponsorPrivateKey: string | undefined;
  private sdkPromise: Promise<FeeSponsorshipSdkModule> | undefined;

  constructor(options: FeeSponsorshipOptions) {
    if (!options.userPrivateKey) {
      throw new ValidationError('userPrivateKey is required.');
    }
    this.network = options.network ?? 'testnet';
    this.host = options.host ?? DEFAULT_HOST;
    this.userPrivateKey = options.userPrivateKey;
    this.sponsorPrivateKey = options.sponsorPrivateKey;
  }

  async submitOnchain(call: SponsoredCall): Promise<OnchainSponsorshipResult> {
    const sponsorPk = this.requireSponsor();
    const sdk = await this.loadSdk();

    const user = this.makeProgramManager(sdk, this.userPrivateKey);
    const sponsor = this.makeProgramManager(sdk, sponsorPk);

    const { authorization, feeAuthorization, executionId, baseFeeMicrocredits, baseFeeCredits } =
      await this.buildAuthorizations(user, sponsor, call);

    const tx = await sponsor.pm.buildTransactionFromAuthorization({
      programName: call.programName,
      authorization,
      feeAuthorization,
    });

    const transactionId = await sponsor.pm.networkClient.submitTransaction(tx.toString());

    return {
      mode: 'onchain',
      transactionId,
      executionId,
      estimatedBaseFeeMicrocredits: baseFeeMicrocredits.toString(),
      estimatedBaseFeeCredits: baseFeeCredits,
      priorityFeeCredits: call.priorityFee ?? 0,
      userAddress: user.account.address().to_string(),
      sponsorAddress: sponsor.account.address().to_string(),
    };
  }

  async submitDelegated(call: DelegatedSponsoredCall): Promise<DelegatedSponsorshipResult> {
    const sdk = await this.loadSdk();
    const user = this.makeProgramManager(sdk, this.userPrivateKey);

    const broadcast = call.broadcast ?? true;
    const splitFeeAuthorization = call.splitFeeAuthorization ?? true;

    const provingRequest = splitFeeAuthorization
      ? await this.buildSplitProvingRequest(sdk, user, call, broadcast)
      : await user.pm.provingRequest({
          programName: call.programName,
          functionName: call.functionName,
          priorityFee: call.priorityFee ?? 0,
          privateFee: call.privateFee ?? false,
          inputs: [...call.inputs],
          broadcast,
          useFeeMaster: true,
        });

    const response = await user.pm.networkClient.submitProvingRequest({
      provingRequest,
      ...(call.prover?.url !== undefined && { url: call.prover.url }),
      ...(call.prover?.apiKey !== undefined && { apiKey: call.prover.apiKey }),
      ...(call.prover?.consumerId !== undefined && { consumerId: call.prover.consumerId }),
      dpsPrivacy: call.prover?.dpsPrivacy ?? true,
    });

    return {
      mode: 'delegated',
      userAddress: user.account.address().to_string(),
      broadcastRequested: broadcast,
      usedFeeMaster: !splitFeeAuthorization,
      splitFeeAuthorization,
      response,
    };
  }

  private async buildSplitProvingRequest(
    sdk: FeeSponsorshipSdkModule,
    user: SponsorshipParty,
    call: DelegatedSponsoredCall,
    broadcast: boolean,
  ): Promise<FeeSponsorshipProvingRequest> {
    const sponsorPk = this.requireSponsor();
    const sponsor = this.makeProgramManager(sdk, sponsorPk);
    const { authorization, feeAuthorization } = await this.buildAuthorizations(user, sponsor, call);
    return sdk.ProvingRequest.new(authorization, feeAuthorization, broadcast);
  }

  private async buildAuthorizations(
    user: SponsorshipParty,
    sponsor: SponsorshipParty,
    call: SponsoredCall,
  ): Promise<BuiltAuthorizations> {
    const authorization = await user.pm.buildAuthorization({
      programName: call.programName,
      functionName: call.functionName,
      inputs: [...call.inputs],
    });
    const executionId = authorization.toExecutionId().toString();
    const baseFeeMicrocredits = await sponsor.pm.estimateFeeForAuthorization({
      programName: call.programName,
      authorization,
    });
    const baseFeeCredits = Number(baseFeeMicrocredits) / 1_000_000;
    const feeAuthorization = await sponsor.pm.buildFeeAuthorization({
      deploymentOrExecutionId: executionId,
      baseFeeCredits,
      priorityFeeCredits: call.priorityFee ?? 0,
      privateKey: sponsor.account.privateKey(),
    });
    return { authorization, feeAuthorization, executionId, baseFeeMicrocredits, baseFeeCredits };
  }

  private makeProgramManager(sdk: FeeSponsorshipSdkModule, privateKey: string): SponsorshipParty {
    const { Account, ProgramManager, AleoKeyProvider, NetworkRecordProvider, AleoNetworkClient } =
      sdk;
    const account = new Account({ privateKey });
    const networkClient = new AleoNetworkClient(this.host);
    const keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);
    const recordProvider = new NetworkRecordProvider(account, networkClient);
    const pm = new ProgramManager(this.host, keyProvider, recordProvider);
    pm.setAccount(account);
    return { account, pm };
  }

  private requireSponsor(): string {
    if (!this.sponsorPrivateKey) {
      throw new ValidationError('sponsorPrivateKey is required for fee sponsorship.');
    }
    return this.sponsorPrivateKey;
  }

  private loadSdk(): Promise<FeeSponsorshipSdkModule> {
    if (!this.sdkPromise) {
      const sub = this.network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
      this.sdkPromise = import(`@provablehq/sdk/${sub}`).catch((err) => {
        throw new WalletError(
          `FeeSponsorshipService requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
          err,
        );
      }) as Promise<FeeSponsorshipSdkModule>;
    }
    return this.sdkPromise;
  }
}
