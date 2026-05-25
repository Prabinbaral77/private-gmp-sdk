import 'dotenv/config';

import type { AppConfig, Network } from './types.js';

const DEFAULTS = {
  port: 3000,
  network: 'testnet' as Network,
  host: 'https://api.provable.com/v2',
  defaultPriorityFeeCredits: 0,
  maxBaseFeeCredits: 10,
  maxPriorityFeeCredits: 1,
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function asNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative number, got ${value}`);
  }
  return n;
}

function loadApiKeys(): ReadonlySet<string> {
  const raw = process.env['API_KEYS'] ?? '';
  const keys = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return new Set(keys);
}

export function loadConfig(): AppConfig {
  const network: Network =
    process.env['ALEO_NETWORK'] === 'mainnet' ? 'mainnet' : DEFAULTS.network;

  return {
    port: asNumber(process.env['PORT'], DEFAULTS.port, 'PORT'),
    network,
    host: process.env['ALEO_API_HOST'] ?? DEFAULTS.host,
    sponsorPrivateKey: requireEnv('SPONSOR_ALEO_PRIVATE_KEY'),

    defaultPriorityFeeCredits: asNumber(
      process.env['DEFAULT_PRIORITY_FEE_CREDITS'],
      DEFAULTS.defaultPriorityFeeCredits,
      'DEFAULT_PRIORITY_FEE_CREDITS',
    ),
    maxBaseFeeCredits: asNumber(
      process.env['MAX_BASE_FEE_CREDITS'],
      DEFAULTS.maxBaseFeeCredits,
      'MAX_BASE_FEE_CREDITS',
    ),
    maxPriorityFeeCredits: asNumber(
      process.env['MAX_PRIORITY_FEE_CREDITS'],
      DEFAULTS.maxPriorityFeeCredits,
      'MAX_PRIORITY_FEE_CREDITS',
    ),

    apiKeys: loadApiKeys(),
  };
}
