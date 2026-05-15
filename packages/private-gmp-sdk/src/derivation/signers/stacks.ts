import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { ValidationError, WalletError } from '../../utils/errors';

import type {
  CrossChainSigner,
  SignedMessage,
  StacksSignerOptions,
} from '../../types/derivation';

type StacksTransactionsLike = {
  privateKeyToAddress(privateKey: string, network?: 'mainnet' | 'testnet'): string;
  signMessageHashRsv(args: { messageHash: string; privateKey: string }): string;
};

async function loadStacks(): Promise<StacksTransactionsLike> {
  try {
    const mod = (await import('@stacks/transactions')) as unknown as StacksTransactionsLike & {
      default?: StacksTransactionsLike;
    };
    return (mod.default ?? mod) as StacksTransactionsLike;
  } catch (err) {
    throw new WalletError('StacksSigner requires optional peer dep: @stacks/transactions.', err);
  }
}

const stripHexPrefix = (s: string): string => s.replace(/^0x/, '');

export class StacksSigner implements CrossChainSigner {
  public readonly chain = 'stacks' as const;

  constructor(private readonly options: StacksSignerOptions) {
    if (typeof options.privateKey !== 'string' || options.privateKey.length === 0) {
      throw new ValidationError('StacksSigner: privateKey must be a non-empty hex string.');
    }
    const cleaned = stripHexPrefix(options.privateKey);
    if (!/^[0-9a-fA-F]+$/.test(cleaned) || (cleaned.length !== 64 && cleaned.length !== 66)) {
      throw new ValidationError(
        'StacksSigner: privateKey must be a 32-byte hex string, optionally suffixed with "01" for the compressed flag.',
      );
    }
  }

  static fromPrivateKey(
    privateKey: string,
    network: 'mainnet' | 'testnet' = 'mainnet',
  ): StacksSigner {
    return new StacksSigner({ privateKey, network });
  }

  async sign(message: string): Promise<SignedMessage> {
    const { privateKeyToAddress, signMessageHashRsv } = await loadStacks();
    const network = this.options.network ?? 'mainnet';
    const privateKey = stripHexPrefix(this.options.privateKey);

    const messageHash = createHash('sha256').update(message, 'utf8').digest('hex');
    const signatureHex = signMessageHashRsv({ messageHash, privateKey });
    const signatureBytes = Uint8Array.from(Buffer.from(signatureHex, 'hex'));

    return {
      signerId: privateKeyToAddress(privateKey, network),
      signatureBytes,
      signatureDisplay: signatureHex,
    };
  }
}
