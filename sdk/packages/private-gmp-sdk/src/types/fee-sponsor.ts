export interface FeeSponsorClientOptions {
  /** Base URL of the fee-sponsorship server. Defaults to {@link DEFAULT_FEE_SPONSOR_URL}. */
  readonly baseUrl?: string;
  /** API key sent as `Authorization: Bearer <apiKey>`. */
  readonly apiKey: string;
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
