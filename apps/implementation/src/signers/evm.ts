import { Wallet, getBytes } from 'ethers';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

export type EvmSignerOptions = {
  /** Hex-encoded EVM private key (with or without 0x prefix). */
  readonly privateKey: string;
};

export class EvmSigner {
  public readonly chain = 'evm' as const;

  constructor(private readonly options: EvmSignerOptions) {
    if (typeof options.privateKey !== 'string' || options.privateKey.length === 0) {
      throw new Error('EvmSigner: privateKey must be a non-empty hex string.');
    }
  }

  static fromPrivateKey(privateKey: string): EvmSigner {
    return new EvmSigner({ privateKey });
  }

  async sign(message: string): Promise<SignedMessage> {
    const wallet = new Wallet(this.options.privateKey);
    const signatureDisplay = await wallet.signMessage(message);
    return {
      signerId: wallet.address,
      signatureBytes: getBytes(signatureDisplay),
      signatureDisplay,
    };
  }
}
