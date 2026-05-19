import type { AleoNetwork, SignedMessage } from '@venture23-aleo/private-gmp-sdk';

type ProvableHqAccount = {
  privateKey(): { to_string(): string };
  address(): { to_string(): string };
  sign(message: Uint8Array): { to_string(): string };
};

type ProvableHqModule = {
  Account: new (init?: { seed?: Uint8Array; privateKey?: string }) => ProvableHqAccount;
};

async function loadProvableHq(network: AleoNetwork): Promise<ProvableHqModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  return (await import(`@provablehq/sdk/${sub}`)) as ProvableHqModule;
}

export type AleoSignedMessage = SignedMessage & {
  /** Private key used to sign — useful when {@link AleoSigner.random} was the factory. */
  readonly privateKey: string;
};

export type AleoSignerOptions = {
  readonly network?: AleoNetwork;
  /** Existing Aleo private key. Omit to construct a randomly-keyed signer via {@link AleoSigner.random}. */
  readonly privateKey?: string;
};

export class AleoSigner {
  public readonly chain = 'aleo' as const;

  constructor(private readonly options: AleoSignerOptions = {}) {
    if (
      options.privateKey !== undefined &&
      (typeof options.privateKey !== 'string' || options.privateKey.length === 0)
    ) {
      throw new Error('AleoSigner: privateKey must be a non-empty string when provided.');
    }
  }

  static fromPrivateKey(privateKey: string, network: AleoNetwork = 'testnet'): AleoSigner {
    return new AleoSigner({ privateKey, network });
  }

  static random(network: AleoNetwork = 'testnet'): AleoSigner {
    return new AleoSigner({ network });
  }

  async sign(message: string): Promise<AleoSignedMessage> {
    const { Account } = await loadProvableHq(this.options.network ?? 'testnet');
    const account = this.options.privateKey
      ? new Account({ privateKey: this.options.privateKey })
      : new Account();
    const signature = account.sign(new TextEncoder().encode(message)).to_string();
    return {
      signerId: account.address().to_string(),
      signatureBytes: new TextEncoder().encode(signature),
      signatureDisplay: signature,
      privateKey: account.privateKey().to_string(),
    };
  }
}
