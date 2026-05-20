import 'dotenv/config';

import type { Allowlist, AppConfig, Network } from './types.js';

// Edit this map to control which (program, function) pairs the sponsor will pay for.
// Key   = program ID (e.g. "credits.aleo")
// Value = list of allowed function names within that program.
// An empty map disables sponsorship entirely (every request is rejected).
const ALLOWED_PROGRAMS: Record<string, readonly string[]> = {
  // 'credits.aleo': ['transfer_public'],
  'sample_program.aleo': ['main'],
};

const DEFAULTS = {
  port: 3000,
  network: 'testnet' as Network,
  host: 'https://api.provable.com/v2',
  defaultPriorityFeeCredits: 0,
  maxBaseFeeCredits: 10,
  maxPriorityFeeCredits: 1,
  proverDpsPrivacy: true,
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function asNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative number, got ${value}`);
  }
  return n;
}

function buildAllowlist(): Allowlist {
  const out: Record<string, ReadonlySet<string>> = {};
  for (const [program, fns] of Object.entries(ALLOWED_PROGRAMS)) {
    out[program] = new Set(fns);
  }
  return Object.freeze(out);
}

export function loadConfig(): AppConfig {
  const network: Network =
    process.env['ALEO_NETWORK'] === 'mainnet' ? 'mainnet' : DEFAULTS.network;

  return {
    port: asNumber(process.env['PORT'], DEFAULTS.port, 'PORT'),
    network,
    host: process.env['ALEO_API_HOST'] ?? DEFAULTS.host,
    sponsorPrivateKey: requireEnv('SPONSOR_ALEO_PRIVATE_KEY'),

    proverUrl: optionalEnv('PROVER_URL'),
    proverApiKey: optionalEnv('PROVER_API_KEY'),
    proverConsumerId: optionalEnv('PROVER_CONSUMER_ID'),
    proverDpsPrivacy: asBool(process.env['PROVER_DPS_PRIVACY'], DEFAULTS.proverDpsPrivacy),

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

    allowlist: buildAllowlist(),
  };
}
