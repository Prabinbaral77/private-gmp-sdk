 import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import { Wallet } from 'ethers';
import {
  AleoSourceSigner,
  BitcoinSigner,
  EvmSigner,
  SolanaSigner,
  StacksSigner,
  StellarSigner,
  SuiSigner,
  assertSourceChain,
  deriveAleoAccount,
} from '@venture23-aleo/private-gmp-sdk';
import type { AleoNetwork, CrossChainSigner, SourceChain } from '@venture23-aleo/private-gmp-sdk';
import bs58 from 'bs58';

import { parseArgs, printJson } from '../utils.js';

// pnpm derive --chain solana "message"
const DEFAULT_MESSAGE = 'private-gmp-sdk implementation: derive deterministic Aleo account';

function buildSigner(chain: SourceChain, network: AleoNetwork): CrossChainSigner {
  if (chain === 'evm') {
    const pk = process.env.EVM_PRIVATE_KEY ?? Wallet.createRandom().privateKey;
    return new EvmSigner({ privateKey: pk });
  }
  if (chain === 'solana') {
    const b58 = process.env.SOLANA_PRIVATE_KEY_B58;
    if (b58) return SolanaSigner.fromBase58SecretKey(b58);
    const kp = Keypair.generate();
    return new SolanaSigner({ secretKey: bs58.encode(kp.secretKey) });
  }
  if (chain === 'sui') {
    const hex = process.env.SUI_PRIVATE_KEY_HEX;
    if (hex) return SuiSigner.fromHexSeed(hex);
    return new SuiSigner({ seed: Buffer.from(randomBytes(32)).toString('hex') });
  }
  if (chain === 'bitcoin') {
    const wif = process.env.BTC_WIF;
    if (!wif) throw new Error('Set BTC_WIF for chain=bitcoin');
    return new BitcoinSigner({ wif });
  }
  if (chain === 'stellar') {
    const secret = process.env.STELLAR_SECRET_KEY;
    if (!secret) throw new Error('Set STELLAR_SECRET_KEY for chain=stellar');
    return new StellarSigner({ secret });
  }
  if (chain === 'stacks') {
    const pk = process.env.STACKS_PRIVATE_KEY;
    if (!pk) throw new Error('Set STACKS_PRIVATE_KEY for chain=stacks');
    return new StacksSigner({ privateKey: pk });
  }
  const sourcePk = process.env.ALEO_SOURCE_PRIVATE_KEY;
  return new AleoSourceSigner({
    network,
    ...(sourcePk !== undefined && { privateKey: sourcePk }),
  });
}

export async function runDerive(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const chain = (args.flags['chain'] as string | undefined) ?? 'aleo';
  assertSourceChain(chain);
  const network: AleoNetwork =
    (process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const message = args.positional.join(' ').trim() || DEFAULT_MESSAGE;

  const signer = buildSigner(chain, network);
  const result = await deriveAleoAccount({ signer, message, network });

  printJson({
    source: result.source,
    aleo: {
      network: result.aleo.network,
      address: result.aleo.address,
      viewKey: result.aleo.viewKey,
      privateKey: result.aleo.privateKey,
    },
    derivation: {
      domainSeparator: result.derivation.domainSeparator,
      hkdfInfoUtf8: result.derivation.hkdfInfoUtf8,
      seeds: result.derivation.seed
    },
  });
}
