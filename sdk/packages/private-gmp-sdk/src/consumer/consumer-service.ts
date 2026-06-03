import {
  CONSUMERS_ENDPOINT,
  DEFAULT_CONSUMER_API_URL,
  VERU_CONSUMER_USERNAME_PREFIX,
} from '@/constants/consumer';
import type {
  ProvableConsumerApiResponse,
  ProvableConsumerRegisterParams,
  ProvableConsumerRegistration,
  ProvableConsumerServiceOptions,
} from '@/types/consumer';
import { assertAddress } from '@/utils/aleo-literals';
import { NetworkError } from '@/utils/errors';

// Re-export the public types from their home in `@/types` so consumers can keep
// importing them from the service entrypoint (see `consumer/index.ts`).
export type {
  ProvableConsumerApiResponse,
  ProvableConsumerRegisterParams,
  ProvableConsumerRegistration,
  ProvableConsumerServiceOptions,
} from '@/types/consumer';

/**
 * Registers a Provable consumer to obtain the `consumerId` / `apiKey` pair the
 * SDK uses for hosted record scanning and delegated (fee-sponsored) proving.
 *
 * Wraps `POST /consumers`:
 *
 * ```bash
 * curl -L 'https://api.provable.com/consumers' \
 *   -H 'Content-Type: application/json' -H 'Accept: application/json' \
 *   -d '{ "username": "Veru_private_gmp<aleoAddress><timestamp>" }'
 * ```
 *
 * The username is namespaced with the user's Aleo address and a timestamp so it
 * is recognizable and unique. The raw response is mapped to a structured,
 * camelCased {@link ProvableConsumerRegistration}.
 */
export class ProvableConsumerService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ProvableConsumerServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_CONSUMER_API_URL;
    const fetchImpl =
      options.fetchImpl ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new NetworkError(
        'No fetch implementation available (global fetch missing). Pass options.fetchImpl.',
      );
    }
    this.fetchImpl = fetchImpl;
  }

  /**
   * Register a new consumer for `aleoAddress` and return the resulting
   * credentials. Throws a {@link NetworkError} on transport failure, a non-2xx
   * response, or a malformed body; a {@link ValidationError} if `aleoAddress`
   * is not an Aleo address.
   */
  async register(
    params: ProvableConsumerRegisterParams,
  ): Promise<ProvableConsumerRegistration> {
    const address = assertAddress(params.aleoAddress, 'aleoAddress');
    const username = params.username ?? buildConsumerUsername(address, params.timestamp ?? Date.now());
    const url = new URL(CONSUMERS_ENDPOINT, this.baseUrl).toString();

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username }),
      });
    } catch (err) {
      throw new NetworkError(`Failed to reach Provable consumers API at ${url}.`, err);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new NetworkError(
        `Failed to create consumer: status=${res.status} ${res.statusText}, body=${body}`,
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      throw new NetworkError('Provable consumers API returned a non-JSON body.', err);
    }

    return toRegistration(data, username);
  }
}

/**
 * Build the consumer username:
 * `${VERU_CONSUMER_USERNAME_PREFIX}${aleoAddress}${timestamp}`.
 */
export function buildConsumerUsername(aleoAddress: string, timestamp: number): string {
  return `${VERU_CONSUMER_USERNAME_PREFIX}${aleoAddress}${timestamp}`;
}

/** Validate and map the raw API body to a structured registration result. */
function toRegistration(data: unknown, username: string): ProvableConsumerRegistration {
  const body = data as Partial<ProvableConsumerApiResponse> | null | undefined;
  const consumerId = body?.consumer?.id;
  const apiKey = body?.key;
  const registrationId = body?.id;
  const createdAt = body?.created_at;
  if (
    typeof consumerId !== 'string' ||
    typeof apiKey !== 'string' ||
    typeof registrationId !== 'string' ||
    typeof createdAt !== 'number'
  ) {
    throw new NetworkError(`Invalid consumer response: ${JSON.stringify(data)}`);
  }
  return {
    consumerId,
    apiKey,
    registrationId,
    createdAt,
    username,
    raw: body as ProvableConsumerApiResponse,
  };
}
