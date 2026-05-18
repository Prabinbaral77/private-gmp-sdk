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
  /** Private key used to sign; freshly generated when no input was provided. */
  readonly privateKey: string;
};

export async function signAleoMessage(
  message: string,
  options: { privateKey?: string; network?: AleoNetwork } = {},
): Promise<AleoSignedMessage> {
  const { Account } = await loadProvableHq(options.network ?? 'testnet');
  const account = options.privateKey
    ? new Account({ privateKey: options.privateKey })
    : new Account();
  const signature = account.sign(new TextEncoder().encode(message)).to_string();
  return {
    signerId: account.address().to_string(),
    signatureBytes: new TextEncoder().encode(signature),
    signatureDisplay: signature,
    privateKey: account.privateKey().to_string(),
  };
}
