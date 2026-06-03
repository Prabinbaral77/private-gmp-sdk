/**
 * Identifiers for the Provable consumer-registration API (`POST /consumers`),
 * which mints the `consumerId` / `apiKey` pair the SDK uses for hosted record
 * scanning and delegated (fee-sponsored) proving.
 */

/** Default base URL of the Provable API that serves `/consumers`. */
export const DEFAULT_CONSUMER_API_URL = 'https://api.provable.com';

/** Path of the consumer-registration endpoint, relative to the base URL. */
export const CONSUMERS_ENDPOINT = '/consumers';

/**
 * Prefix applied to every generated consumer username so registrations created
 * by this SDK are recognizable in Provable's dashboard. The full username is
 * `${VERU_CONSUMER_USERNAME_PREFIX}${aleoAddress}${timestamp}` — namespaced by
 * the user's Aleo address and made unique by a timestamp.
 */
export const VERU_CONSUMER_USERNAME_PREFIX = 'Veru_private_gmp';
