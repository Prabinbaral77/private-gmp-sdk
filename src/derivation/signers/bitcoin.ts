import { Buffer } from 'node:buffer';

import { ValidationError, WalletError } from '../../utils/errors';

import type {
  BitcoinSignerOptions,
  CrossChainSigner,
  SignedMessage,
} from '../../types/derivation';

type EcPairLike = {
  readonly publicKey: Uint8Array;
  readonly privateKey?: Uint8Array;
  readonly compressed: boolean;
};

type EcPairApi = {
  fromWIF(wif: string, network?: unknown): EcPairLike;
};

type EcPairFactoryFn = (ecc: unknown) => EcPairApi;

type BitcoinNetworksLike = {
  readonly bitcoin: unknown;
  readonly testnet: unknown;
};

type PaymentsLike = {
  p2pkh(args: { pubkey: Uint8Array; network?: unknown }): { address?: string };
};

type BitcoinMessageLike = {
  sign(message: string, privateKey: Uint8Array, compressed: boolean): Buffer;
};

const pickDefault = <T>(mod: unknown): T => {
  const m = mod as { default?: T };
  return (m.default ?? (mod as T)) as T;
};

async function loadBitcoinDeps(): Promise<{
  ECPair: EcPairApi;
  networks: BitcoinNetworksLike;
  payments: PaymentsLike;
  message: BitcoinMessageLike;
}> {
  try {
    const [eccMod, ecpairMod, bitcoinjsMod, messageMod] = await Promise.all([
      import('@bitcoinerlab/secp256k1'),
      import('ecpair'),
      import('bitcoinjs-lib'),
      import('bitcoinjs-message'),
    ]);

    const ecc = pickDefault<unknown>(eccMod);
    const ECPairFactory =
      (ecpairMod as { ECPairFactory?: EcPairFactoryFn }).ECPairFactory ??
      pickDefault<EcPairFactoryFn>(ecpairMod);
    const networks = (bitcoinjsMod as unknown as { networks: BitcoinNetworksLike }).networks;
    const payments = (bitcoinjsMod as unknown as { payments: PaymentsLike }).payments;
    const message = pickDefault<BitcoinMessageLike>(messageMod);

    return { ECPair: ECPairFactory(ecc), networks, payments, message };
  } catch (err) {
    throw new WalletError(
      'BitcoinSigner requires optional peer deps: @bitcoinerlab/secp256k1, ecpair, bitcoinjs-lib, bitcoinjs-message.',
      err,
    );
  }
}

export class BitcoinSigner implements CrossChainSigner {
  public readonly chain = 'bitcoin' as const;

  constructor(private readonly options: BitcoinSignerOptions) {
    if (typeof options.wif !== 'string' || options.wif.length === 0) {
      throw new ValidationError('BitcoinSigner: wif must be a non-empty WIF-encoded string.');
    }
  }

  static fromWif(wif: string): BitcoinSigner {
    return new BitcoinSigner({ wif });
  }

  async sign(message: string): Promise<SignedMessage> {
    const { ECPair, payments, message: bitcoinMessage } = await loadBitcoinDeps();
    const keyPair = ECPair.fromWIF(this.options.wif);
    if (!keyPair.privateKey) {
      throw new ValidationError('BitcoinSigner: WIF decoded without a private key.');
    }

    const sigBuf = bitcoinMessage.sign(
      message,
      Buffer.from(keyPair.privateKey),
      keyPair.compressed,
    );
    const signatureBytes = Uint8Array.from(sigBuf);

    const p2pkh = payments.p2pkh({ pubkey: keyPair.publicKey });
    if (!p2pkh.address) {
      throw new WalletError('BitcoinSigner: failed to derive P2PKH address from public key.');
    }

    return {
      signerId: p2pkh.address,
      signatureBytes,
      signatureDisplay: Buffer.from(signatureBytes).toString('base64'),
    };
  }
}
