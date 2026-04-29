/**
 * Deterministic Aleo account from a foreign-chain signature.
 *
 * Usage:
 *   tsx scripts/derive-aleo-account.ts --chain solana "Sign this message"
 *   tsx scripts/derive-aleo-account.ts --chain sui    "Sign this message"
 *   tsx scripts/derive-aleo-account.ts --chain aleo   "Sign this message"
 *   tsx scripts/derive-aleo-account.ts --chain evm    "Sign this message"
 *
 * Environment:
 *   ALEO_NETWORK=testnet|mainnet                 (default: testnet)
 *   DOMAIN_SEPARATOR=your-domain-separator       (default: SODAX|aleo-keygen|non-evm|v1)
 *   GENERATE_SOURCE_KEY_IF_MISSING=true|false    (default: true)
 *
 *   Solana: SOLANA_PRIVATE_KEY_B58 | SOLANA_PRIVATE_KEY_JSON
 *   Sui:    SUI_PRIVATE_KEY_HEX    | SUI_PRIVATE_KEY_B64
 *   EVM:    EVM_PRIVATE_KEY
 *   Aleo:   ALEO_SOURCE_PRIVATE_KEY
 */
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import { DEFAULT_DERIVATION_MESSAGE } from '../src/constants/derivation';
import {
  AleoSourceSigner,
  EvmSigner,
  SolanaSigner,
  SuiSigner,
  assertSourceChain,
  deriveAleoAccount,
} from '../src/derivation';
import type { AleoNetwork, CrossChainSigner, SourceChain } from '../src/types/derivation';

type CliArgs = {
  chain: SourceChain;
  message: string;
};

type Bs58Like = {
  encode(data: Uint8Array): string;
  decode(s: string): Uint8Array;
};

async function loadDotenvIfPresent(): Promise<void> {
  try {
    await import('dotenv/config' as string);
  } catch {
    // dotenv is optional — fall back to whatever is already in process.env.
  }
}

function parseCli(argv: string[]): CliArgs {
  const chainIdx = argv.findIndex((v) => v === '--chain');
  if (chainIdx === -1 || !argv[chainIdx + 1]) {
    throw new Error('Missing --chain. Use: --chain solana|sui|aleo|evm');
  }
  const chain = (argv[chainIdx + 1] ?? '').toLowerCase();
  assertSourceChain(chain);
  const message =
    argv.filter((_, i) => i !== chainIdx && i !== chainIdx + 1).join(' ') ||
    DEFAULT_DERIVATION_MESSAGE;
  return { chain, message };
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  const lc = v.toLowerCase();
  return lc === '1' || lc === 'true' || lc === 'yes';
}

async function buildSigner(
  chain: SourceChain,
  network: AleoNetwork,
): Promise<{ signer: CrossChainSigner; generated: Record<string, string> | null }> {
  const allowGenerate = envBool('GENERATE_SOURCE_KEY_IF_MISSING', true);

  if (chain === 'evm') {
    let pk = process.env.EVM_PRIVATE_KEY;
    let generated: Record<string, string> | null = null;
    if (!pk) {
      if (!allowGenerate) throw new Error('Missing EVM_PRIVATE_KEY for chain=evm.');
      const { Wallet } = await import('ethers');
      const w = Wallet.createRandom();
      pk = w.privateKey;
      generated = { EVM_PRIVATE_KEY: w.privateKey };
    }
    return { signer: new EvmSigner({ privateKey: pk }), generated };
  }

  if (chain === 'solana') {
    if (process.env.SOLANA_PRIVATE_KEY_B58) {
      return {
        signer: await SolanaSigner.fromBase58SecretKey(process.env.SOLANA_PRIVATE_KEY_B58),
        generated: null,
      };
    }
    if (process.env.SOLANA_PRIVATE_KEY_JSON) {
      return {
        signer: SolanaSigner.fromJsonSecretKey(process.env.SOLANA_PRIVATE_KEY_JSON),
        generated: null,
      };
    }
    if (!allowGenerate) {
      throw new Error('Missing Solana key. Set SOLANA_PRIVATE_KEY_B58 or SOLANA_PRIVATE_KEY_JSON.');
    }
    const { Keypair } = await import('@solana/web3.js');
    const bs58Mod = (await import('bs58')) as unknown as { default: Bs58Like };
    const bs58 = bs58Mod.default;
    const kp = Keypair.generate();
    return {
      signer: new SolanaSigner({ secretKey: kp.secretKey }),
      generated: {
        SOLANA_PRIVATE_KEY_B58: bs58.encode(kp.secretKey),
        SOLANA_PRIVATE_KEY_JSON: JSON.stringify(Array.from(kp.secretKey)),
      },
    };
  }

  if (chain === 'sui') {
    if (process.env.SUI_PRIVATE_KEY_HEX) {
      return { signer: SuiSigner.fromHexSeed(process.env.SUI_PRIVATE_KEY_HEX), generated: null };
    }
    if (process.env.SUI_PRIVATE_KEY_B64) {
      return { signer: SuiSigner.fromBase64Seed(process.env.SUI_PRIVATE_KEY_B64), generated: null };
    }
    if (!allowGenerate) {
      throw new Error('Missing Sui key. Set SUI_PRIVATE_KEY_HEX or SUI_PRIVATE_KEY_B64.');
    }
    const seed = randomBytes(32);
    return {
      signer: new SuiSigner({ seed }),
      generated: {
        SUI_PRIVATE_KEY_HEX: Buffer.from(seed).toString('hex'),
        SUI_PRIVATE_KEY_B64: Buffer.from(seed).toString('base64'),
      },
    };
  }

  // aleo
  const sourcePk = process.env.ALEO_SOURCE_PRIVATE_KEY;
  if (!sourcePk && !allowGenerate) {
    throw new Error('Missing ALEO_SOURCE_PRIVATE_KEY for chain=aleo.');
  }
  return {
    signer: new AleoSourceSigner({ network, ...(sourcePk !== undefined && { privateKey: sourcePk }) }),
    generated: null,
  };
}

async function main(): Promise<void> {
  await loadDotenvIfPresent();
  const { chain, message } = parseCli(process.argv.slice(2));
  const network = ((process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet'
    ? 'mainnet'
    : 'testnet') as AleoNetwork;
  const domainSeparator = process.env.DOMAIN_SEPARATOR;

  const { signer, generated } = await buildSigner(chain, network);
  const result = await deriveAleoAccount({
    signer,
    message,
    network,
    ...(domainSeparator !== undefined && { domainSeparator }),
  });

  console.log(
    JSON.stringify(
      {
        generated,
        source: result.source,
        derivation: {
          domainSeparator: result.derivation.domainSeparator,
          hkdfInfoUtf8: result.derivation.hkdfInfoUtf8,
          saltSha256DomainHex: result.derivation.saltSha256DomainHex,
        },
        aleo: {
          network: result.aleo.network,
          privateKey: result.aleo.privateKey,
          viewKey: result.aleo.viewKey,
          address: result.aleo.address,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
