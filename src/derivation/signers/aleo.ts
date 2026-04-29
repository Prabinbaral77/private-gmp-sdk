import { WalletError } from '../../utils/errors';
import { createProvableHqAccountFactory } from '../account';

import type {
  AleoAccountFactory,
  AleoSourceSignerOptions,
  CrossChainSigner,
  SignedMessage,
} from '../../types/derivation';

/**
 * Signs with an Aleo private key on the source side.
 *
 * NOTE: Aleo's Schnorr signatures are non-deterministic, so the derived child
 * Aleo account differs across calls even for the same source key + message.
 * Use this only when the *source identity* matters, not when you need
 * reproducibility — Solana / Sui / EVM all give deterministic signatures.
 */
export class AleoSourceSigner implements CrossChainSigner {
  public readonly chain = 'aleo' as const;
  private readonly factory: AleoAccountFactory;
  private readonly privateKey?: string;

  constructor(options: AleoSourceSignerOptions = {}) {
    this.factory =
      options.factory ?? createProvableHqAccountFactory(options.network ?? 'testnet');
    if (options.privateKey !== undefined) {
      this.privateKey = options.privateKey;
    }
  }

  async sign(message: string): Promise<SignedMessage> {
    if (!this.factory.sign) {
      throw new WalletError('AleoSourceSigner: AleoAccountFactory does not implement sign().');
    }
    const msgBytes = new TextEncoder().encode(message);
    const result = await this.factory.sign(this.privateKey, msgBytes);
    const sigBytes = new TextEncoder().encode(result.signature);
    return {
      signerId: result.address,
      signatureBytes: sigBytes,
      signatureDisplay: result.signature,
    };
  }
}
