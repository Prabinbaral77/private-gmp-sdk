import { RecordScannerService } from '../scanner/scanner';
import { NetworkError, WalletError } from '../utils/errors';

import type { AleoNetwork } from '../types/derivation';

/**
 * Aleo vault — caches a user's source Aleo signature on-chain so cross-chain
 * derivation from an Aleo source stays deterministic even though Aleo's
 * Schnorr signing uses a fresh random nonce per call.
 *
 * The vault program (`veru_pcc_vault.aleo`) exposes:
 *   mapping is_available: field => bool;     // key = BHP256(self.caller)
 *   record  userInfo     { owner, signature: signature }
 *
 * Setting a user's signature on-chain is the consumer's responsibility — this
 * module only **reads** the cache.
 */

export const VAULT_PROGRAM_ID = 'veru_pcc_vault.aleo';
export const VAULT_MAPPING_NAME = 'is_available';
export const VAULT_RECORD_NAME = 'userInfo';

type ProvableHqModule = typeof import('@provablehq/sdk/testnet.js');

async function loadProvableHq(network: AleoNetwork): Promise<ProvableHqModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as ProvableHqModule;
  } catch (err) {
    throw new WalletError(
      `aleo-vault requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

export async function aleoAddressFromPrivateKey(
  privateKey: string,
  network: AleoNetwork,
): Promise<string> {
  const { Account } = await loadProvableHq(network);
  return new Account({ privateKey }).address().to_string();
}

/** BHP256 hash of an Aleo address, formatted as the `…field` string used in mapping keys. */
export async function bhp256AddressKey(address: string, network: AleoNetwork): Promise<string> {
  const { Address, BHP256 } = await loadProvableHq(network);
  const bits = Address.from_string(address).toBitsLe();
  // The runtime BHP256.hash accepts (bits, destinationType), but the WASM-generated
  // TS declaration only types the first parameter.
  const hashed = (new BHP256().hash as (b: unknown, t: string) => { toString(): string })(
    bits,
    'field',
  );
  return hashed.toString();
}

export type VaultMappingLookupOptions = {
  readonly apiHost: string;
  readonly fetchImpl?: typeof fetch;
};

/**
 * Look up `veru_pcc_vault.aleo`'s `is_available[<addressKey>]`. Missing/null/false
 * all map to false.
 */
export async function isAleoWalletRegistered(
  addressKey: string,
  network: AleoNetwork,
  opts: VaultMappingLookupOptions,
): Promise<boolean> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `${opts.apiHost}/${network}/program/${VAULT_PROGRAM_ID}/mapping/${VAULT_MAPPING_NAME}/${addressKey}`;
  const res = await fetchFn(url);
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new NetworkError(`Vault mapping lookup failed: HTTP ${res.status}`);
  }
  const body = (await res.text()).trim();
  if (body === '' || body === 'null') return false;
  // The Provable API returns the value as a JSON-encoded string, e.g. `"true"`.
  const unquoted = body.replace(/^"|"$/g, '');
  return unquoted === 'true';
}

export type VaultRecordScanOptions = {
  readonly host?: string;
  readonly scannerUrl?: string;
  readonly apiKey?: string;
  readonly consumerId?: string;
};

/**
 * Scan `veru_pcc_vault.aleo`'s `userInfo` records owned by `privateKey`'s view key,
 * decrypt them, and return the cached Aleo signature string. Returns null if
 * no matching/decryptable record is found.
 */
export async function fetchCachedAleoSignature(
  privateKey: string,
  network: AleoNetwork,
  opts: VaultRecordScanOptions = {},
): Promise<string | null> {
  const { PrivateKey, RecordCiphertext } = await loadProvableHq(network);

  const scanner = new RecordScannerService({
    network,
    privateKey,
    ...(opts.host !== undefined && { host: opts.host }),
    ...(opts.scannerUrl !== undefined && { scannerUrl: opts.scannerUrl }),
    ...(opts.apiKey !== undefined && { apiKey: opts.apiKey }),
    ...(opts.consumerId !== undefined && { consumerId: opts.consumerId }),
  });

  const creds =
    opts.apiKey && opts.consumerId
      ? { apiKey: opts.apiKey, consumerId: opts.consumerId }
      : await scanner.getCredentials();

  const result = await scanner.hosted({
    programs: [VAULT_PROGRAM_ID],
    records: [VAULT_RECORD_NAME],
    apiKey: creds.apiKey,
    consumerId: creds.consumerId,
    limit: 25,
  });

  if (result.records.length === 0) return null;

  const viewKey = PrivateKey.from_string(privateKey).to_view_key();
  for (const rec of result.records) {
    const ct = typeof rec['record_ciphertext'] === 'string' ? rec['record_ciphertext'] : undefined;
    if (!ct) continue;
    try {
      const cipher = RecordCiphertext.fromString(ct);
      if (!cipher.isOwner(viewKey)) continue;
      const plain = cipher.decrypt(viewKey);
      const sig = parseSignatureField(plain.toString());
      if (sig) return sig;
    } catch {
      continue;
    }
  }
  return null;
}

/** Pull the `signature` field out of a decrypted plaintext record string. */
function parseSignatureField(plaintext: string): string | null {
  const match = plaintext.match(/signature\s*:\s*(sign1[0-9a-z]+)/);
  return match ? (match[1] ?? null) : null;
}

export type AleoVaultLookupOptions = VaultMappingLookupOptions & VaultRecordScanOptions;

/**
 * Convenience: combines {@link isAleoWalletRegistered} and
 * {@link fetchCachedAleoSignature}. Returns the cached signature or null.
 */
export async function tryFetchCachedAleoSignature(
  privateKey: string,
  network: AleoNetwork,
  opts: AleoVaultLookupOptions,
): Promise<{ address: string; signature: string } | null> {
  const address = await aleoAddressFromPrivateKey(privateKey, network);
  const key = await bhp256AddressKey(address, network);
  const registered = await isAleoWalletRegistered(key, network, opts);
  if (!registered) return null;
  const signature = await fetchCachedAleoSignature(privateKey, network, opts);
  return signature ? { address, signature } : null;
}
