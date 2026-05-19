export type NetworkName = 'mainnet' | 'testnet' | 'localnet' | 'custom';

export type NetworkConfig = {
  readonly name: NetworkName;
  readonly rpcUrl: string;
  readonly explorerUrl?: string;
  /** Aleo network ID (e.g. 0 = testnet3, 1 = mainnet). */
  readonly chainId: number;
};
