import { MappingReader } from '@venture23-aleo/private-gmp-sdk/mappings';
import type { EvmMappingKey } from '@venture23-aleo/private-gmp-sdk/mappings';
import type { AleoNetwork } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireFlag } from '../utils.js';

// pnpm mapping --chain aleo --program <p.aleo> --mapping <name> --key <literal> [--network testnet] [--rpc URL]
// pnpm mapping --chain evm --rpc <url> --address 0x.. --signature "function m(address) view returns (uint256)" --key 0x.. [--key 0x..] [--block latest]
//
// Generic read of on-chain key/value state via the SDK's MappingReader. The
// Aleo side resolves program/mapping[key] through the provablehq indexer; the
// EVM side calls a Solidity mapping's public getter through viem and decodes
// the result. `--key` is repeatable for nested EVM mappings.
export async function runMapping(argv: string[]): Promise<void> {
  const args = parseArgs(argv, new Set(['key']));
  const chain = (requireFlag(args, 'chain') || 'aleo').toLowerCase();
  const reader = new MappingReader();

  if (chain === 'aleo') {
    const network: AleoNetwork =
      (args.flags['network'] as string | undefined)?.toLowerCase() === 'mainnet'
        ? 'mainnet'
        : 'testnet';
    const rpcUrl = args.flags['rpc'] as string | undefined;
    const keyFlag = args.flags['key'];
    const key = Array.isArray(keyFlag) ? keyFlag[0] : keyFlag;
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('--key is required for an Aleo mapping read.');
    }
    const params = {
      network,
      program: requireFlag(args, 'program'),
      mapping: requireFlag(args, 'mapping'),
      key,
      ...(rpcUrl !== undefined && { rpcUrl }),
    };
    const value = await reader.readAleoMapping(params);
    printJson({ ok: true, chain, params, value });
    return;
  }

  if (chain === 'evm') {
    const key = readEvmKeys(args.flags['key']);
    const block = args.flags['block'] as string | undefined;
    const params = {
      rpcUrl: requireFlag(args, 'rpc'),
      address: requireFlag(args, 'address'),
      signature: requireFlag(args, 'signature'),
      key,
      ...(block !== undefined && { blockTag: block as 'latest' }),
    };
    const value = await reader.readEvmMapping(params);
    printJson({ ok: true, chain, params, value });
    return;
  }

  throw new Error(`Unknown --chain '${chain}'. Expected 'aleo' or 'evm'.`);
}

/** Coerce repeatable `--key` flags into a single key or an array, decoding numeric-looking values. */
function readEvmKeys(raw: string | string[] | true | undefined): EvmMappingKey | EvmMappingKey[] {
  if (raw === undefined || raw === true) {
    throw new Error('--key is required for an EVM mapping read.');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  const keys = list.map(coerceEvmKey);
  return keys.length === 1 ? (keys[0] as EvmMappingKey) : keys;
}

/** Pass addresses/hex through as strings; turn bare integers into bigint for uint keys. */
function coerceEvmKey(value: string): EvmMappingKey {
  if (value.startsWith('0x') || value.startsWith('0X')) return value;
  if (/^\d+$/.test(value)) return BigInt(value);
  return value;
}
