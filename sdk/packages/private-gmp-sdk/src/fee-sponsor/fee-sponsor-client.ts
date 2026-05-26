import { DEFAULT_FEE_SPONSOR_URL, FEE_AUTHORIZATION_PATH } from '@/constants/fee-sponsor';
import type {
  FeeAuthorizationRequest,
  FeeAuthorizationResponse,
  FeeSponsorClientOptions,
} from '@/types/fee-sponsor';

export class FeeSponsorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'FeeSponsorError';
  }
}

/**
 * Thin proxy over the fee-sponsorship HTTP server. Consumers of the SDK call
 * this directly and never touch the server URL or auth headers themselves.
 */
export class FeeSponsorClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: FeeSponsorClientOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_FEE_SPONSOR_URL).replace(/\/+$/, '');
    this.apiKey = options.apiKey;
  }

  async requestFeeAuthorization(req: FeeAuthorizationRequest): Promise<FeeAuthorizationResponse> {
    const res = await fetch(`${this.baseUrl}${FEE_AUTHORIZATION_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        executionId: req.executionId,
        baseFeeCredits: req.baseFeeCredits,
        ...(req.priorityFeeCredits !== undefined && {
          priorityFeeCredits: req.priorityFeeCredits,
        }),
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      const message = safeParseError(text) ?? text ?? `fee-sponsor request failed (${res.status})`;
      throw new FeeSponsorError(message, res.status);
    }
    return JSON.parse(text) as FeeAuthorizationResponse;
  }
}

function safeParseError(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : undefined;
  } catch {
    return undefined;
  }
}
