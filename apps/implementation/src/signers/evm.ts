import { Wallet, getBytes } from 'ethers';

import type { SignedMessage } from '@venture23-aleo/private-gmp-sdk';

export async function signEvmMessage(
  privateKey: string,
  message: string,
): Promise<SignedMessage> {
  const wallet = new Wallet(privateKey);
  const signatureDisplay = await wallet.signMessage(message);
  return {
    signerId: wallet.address,
    signatureBytes: getBytes(signatureDisplay),
    signatureDisplay,
  };
}
