import { ValidationError, WalletError } from '../../utils/errors';

import type {
  CrossChainSigner,
  EvmSignerOptions,
  SignedMessage,
} from '../../types/derivation';

async function loadEthers(): Promise<typeof import('ethers')> {
  try {
    return await import('ethers');
  } catch (err) {
    throw new WalletError('EvmSigner requires optional peer dep: ethers.', err);
  }
}

export class EvmSigner implements CrossChainSigner {
  public readonly chain = 'evm' as const;

  constructor(private readonly options: EvmSignerOptions) {
    if (typeof options.privateKey !== 'string' || options.privateKey.length === 0) {
      throw new ValidationError('EvmSigner: privateKey must be a non-empty string.');
    }
  }

  async sign(message: string): Promise<SignedMessage> {
    const { Wallet, getBytes } = await loadEthers();
    const wallet = new Wallet(this.options.privateKey);
    const sigHex = await wallet.signMessage(message);
    return {
      signerId: wallet.address,
      signatureBytes: getBytes(sigHex),
      signatureDisplay: sigHex,
    };
  }
}
