/**
 * Public types for the Provable consumer-registration service. The service
 * itself lives in `@/consumer/consumer-service`; this file holds only the
 * shapes consumers see.
 */

/**
 * Raw JSON body returned by `POST /consumers`:
 *
 * ```json
 * {
 *   "consumer": { "id": "90cd0e57-cc51-4a23-9706-ce50306a4b0e" },
 *   "created_at": 1780475965,
 *   "id": "5919042c-72b6-4ca4-845e-b2a1de2dff3f",
 *   "key": "lBIQVFp3vtwzzmWzsfpHF8fbyR16PY8G"
 * }
 * ```
 */
export interface ProvableConsumerApiResponse {
  readonly consumer: { readonly id: string };
  readonly created_at: number;
  readonly id: string;
  readonly key: string;
}

/**
 * Structured, camelCased result of registering a Provable consumer. The two
 * fields the rest of the SDK needs are `consumerId` and `apiKey` — pass them to
 * the record scanner (`hosted`/`sdk`) or a delegated proving config.
 */
export interface ProvableConsumerRegistration {
  /** `consumer.id` — the consumer/customer id used as `consumerId`. */
  readonly consumerId: string;
  /** `key` — the API key used as `apiKey`. */
  readonly apiKey: string;
  /** Top-level `id` — the registration record id. */
  readonly registrationId: string;
  /** `created_at` — Unix seconds when the consumer was created. */
  readonly createdAt: number;
  /** The username submitted to the API, for traceability. */
  readonly username: string;
  /** The raw, unmodified API response. */
  readonly raw: ProvableConsumerApiResponse;
}

/** Construction options for {@link ProvableConsumerService}. */
export interface ProvableConsumerServiceOptions {
  /** Base URL of the Provable API. Defaults to `https://api.provable.com`. */
  readonly baseUrl?: string;
  /**
   * Custom `fetch` implementation. Defaults to the global `fetch` (Node ≥ 18).
   * Supply one when running on a runtime without a global `fetch`.
   */
  readonly fetchImpl?: typeof fetch;
}

/** Arguments to {@link ProvableConsumerService.register}. */
export interface ProvableConsumerRegisterParams {
  /** The user's Aleo address (`aleo1…`) — namespaced into the username. */
  readonly aleoAddress: string;
  /**
   * Override the generated username entirely. When omitted, the username is
   * `${VERU_CONSUMER_USERNAME_PREFIX}${aleoAddress}${timestamp}`.
   */
  readonly username?: string;
  /**
   * Timestamp used to make the generated username unique. Defaults to
   * `Date.now()`. Ignored when `username` is supplied.
   */
  readonly timestamp?: number;
}
