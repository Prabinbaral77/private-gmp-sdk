import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { privateKeyToAddress, signMessageHashRsv } from '@stacks/transactions';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

export type StacksNetwork = 'mainnet' | 'testnet';

export type StacksSignerOptions = {
  readonly privateKey: string;
  readonly network?: StacksNetwork;
};

const stripHexPrefix = (s: string): string => s.replace(/^0x/, '');

export class StacksSigner {
  public readonly chain = 'stacks' as const;

  constructor(private readonly options: StacksSignerOptions) {
    if (typeof options.privateKey !== 'string' || options.privateKey.length === 0) {
      throw new Error('StacksSigner: privateKey must be a non-empty hex string.');
    }
    const cleaned = stripHexPrefix(options.privateKey);
    if (!/^[0-9a-fA-F]+$/.test(cleaned) || (cleaned.length !== 64 && cleaned.length !== 66)) {
      throw new Error(
        'StacksSigner: privateKey must be a 32-byte hex string, optionally suffixed with "01" for the compressed flag.',
      );
    }
  }

  static fromPrivateKey(privateKey: string, network: StacksNetwork = 'mainnet'): StacksSigner {
    return new StacksSigner({ privateKey, network });
  }

  async sign(message: string): Promise<SignedMessage> {
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
