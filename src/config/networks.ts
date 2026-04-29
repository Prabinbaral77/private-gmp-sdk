import type { NetworkConfig, NetworkName } from '../types/network';

export const ALEO_NETWORKS = {
  mainnet: {
    name: 'mainnet',
    rpcUrl: 'https://api.explorer.aleo.org/v1/mainnet',
    explorerUrl: 'https://explorer.aleo.org',
    chainId: 1,
  },
  testnet: {
    name: 'testnet',
    rpcUrl: 'https://api.explorer.aleo.org/v1/testnet',
    explorerUrl: 'https://testnet.explorer.aleo.org',
    chainId: 0,
  },
  localnet: {
    name: 'localnet',
    rpcUrl: 'http://localhost:3030',
    chainId: 0,
  },
} as const satisfies Record<Exclude<NetworkName, 'custom'>, NetworkConfig>;

export function resolveNetwork(input: NetworkName | NetworkConfig): NetworkConfig {
  if (typeof input === 'string') {
    if (input === 'custom') {
      throw new Error('Network "custom" requires a full NetworkConfig object.');
    }
    return ALEO_NETWORKS[input];
  }
  return input;
}
