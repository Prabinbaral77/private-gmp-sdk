import {
  AleoAccountDeriver,
  assertSourceChain,
} from '@venture23-aleo/private-gmp-sdk';
import type {
  AleoNetwork,
  SignedMessage,
  SourceChain,
} from '@venture23-aleo/private-gmp-sdk';

import {
  AleoSigner,
  BitcoinSigner,
  EvmSigner,
  SolanaSigner,
  StacksSigner,
  StellarSigner,
  SuiSigner,
} from '../signers/index.js';
import { parseArgs, printJson } from '../utils.js';

// pnpm derive --chain solana "message"
const DEFAULT_MESSAGE = 'private-gmp-sdk implementation: derive deterministic Aleo account';

async function sign(
  chain: SourceChain,
  message: string,
  network: AleoNetwork,
): Promise<SignedMessage> {
  if (chain === 'evm') {
    const privateKey = process.env.EVM_PRIVATE_KEY;
    if (!privateKey) throw new Error('Set EVM_PRIVATE_KEY for chain=evm');
    return EvmSigner.fromPrivateKey(privateKey).sign(message);
  }

  if (chain === 'solana') {
    const secretKeyB58 = process.env.SOLANA_PRIVATE_KEY;
    if (!secretKeyB58) throw new Error('Set SOLANA_PRIVATE_KEY for chain=solana');
    return SolanaSigner.fromBase58SecretKey(secretKeyB58).sign(message);
  }

  if (chain === 'sui') {
    const seedHex = process.env.SUI_PRIVATE_KEY;
    if (!seedHex) throw new Error('Set SUI_PRIVATE_KEY for chain=sui');
    return SuiSigner.fromHexSeed(seedHex).sign(message);
  }

  if (chain === 'bitcoin') {
    const wif = process.env.BITCOIN_WIF;
    if (!wif) throw new Error('Set BITCOIN_WIF for chain=bitcoin');
    return BitcoinSigner.fromWif(wif).sign(message);
  }

  if (chain === 'stellar') {
    const secret = process.env.STELLAR_SECRET_KEY;
    if (!secret) throw new Error('Set STELLAR_SECRET_KEY for chain=stellar');
    return StellarSigner.fromSecret(secret).sign(message);
  }

  if (chain === 'stacks') {
    const pk = process.env.STACKS_PRIVATE_KEY;
    if (!pk) throw new Error('Set STACKS_PRIVATE_KEY for chain=stacks');
    const stacksNetwork =
      (process.env.STACKS_NETWORK ?? 'mainnet').toLowerCase() === 'testnet'
        ? 'testnet'
        : 'mainnet';
    return StacksSigner.fromPrivateKey(pk, stacksNetwork).sign(message);
  }

  const sourcePk = process.env.ALEO_SOURCE_PRIVATE_KEY;
  const aleoSigner = sourcePk
    ? AleoSigner.fromPrivateKey(sourcePk, network)
    : AleoSigner.random(network);
  return aleoSigner.sign(message);
}

export async function runDerive(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const chain = (args.flags['chain'] as string | undefined) ?? 'aleo';
  assertSourceChain(chain);
  const network: AleoNetwork =
    (process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const message = args.positional.join(' ').trim() || DEFAULT_MESSAGE;

  const signed = await sign(chain, message, network);
  const deriver = new AleoAccountDeriver({ network });
  const result = await deriver.derive({
    chain,
    signerId: signed.signerId,
    signatureBytes: signed.signatureBytes,
    signatureDisplay: signed.signatureDisplay,
    message,
  });

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
      seeds: result.derivation.seed,
    },
  });
}
