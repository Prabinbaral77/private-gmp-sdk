import type { Abi, AbiFunction } from 'viem';

import { DEFAULT_ALEO_RPC_URL } from '@/constants/mappings';
import type { AleoNetwork } from '@/types/derivation';
import type {
  AleoMappingReadParams,
  EvmMappingKey,
  EvmMappingReadParams,
} from '@/types/mappings';
import type { SdkModule } from '@/types/scanner';
import { NetworkError, ValidationError, WalletError } from '@/utils/errors';

// Re-export the public types from their home in `@/types` so consumers can keep
// importing them from the mappings entrypoint (see `mappings/index.ts`).
export type {
  AleoMappingReadParams,
  EvmBlockTag,
  EvmMappingKey,
  EvmMappingReadParams,
} from '@/types/mappings';

/** Full `viem` module shape — only loaded when an EVM read is requested. */
type ViemModule = typeof import('viem');

/**
 * Generic, read-only access to on-chain key/value state on both Aleo and EVM.
 *
 * - `readAleoMapping` resolves `program/mapping[key]` via the provablehq
 *   `AleoNetworkClient` (no signing, no fee — a plain indexer read).
 * - `readEvmMapping` calls a Solidity mapping's auto-generated public getter
 *   through viem's `readContract` and returns the decoded value.
 *
 * Both chain SDKs are optional peer deps loaded lazily on first use, matching
 * the rest of the SDK — `@provablehq/sdk` for Aleo, `viem` for EVM. A
 * `WalletError` is thrown if the relevant dep isn't installed.
 */
export class MappingReader {
  /**
   * Read a single Aleo program mapping value. Returns the stored value as its
   * Aleo literal string (e.g. `"100u64"`), or whatever the node returns for an
   * absent key (typically `"null"`).
   */
  async readAleoMapping(params: AleoMappingReadParams): Promise<string> {
    if (typeof params.program !== 'string' || params.program.length === 0) {
      throw new ValidationError('program must be a non-empty program id, e.g. credits.aleo.');
    }
    if (typeof params.mapping !== 'string' || params.mapping.length === 0) {
      throw new ValidationError('mapping must be a non-empty mapping name.');
    }
    if (typeof params.key !== 'string' || params.key.length === 0) {
      throw new ValidationError('key must be a non-empty Aleo literal string.');
    }

    const sdk = await loadSdk(params.network);
    const client = new sdk.AleoNetworkClient(params.rpcUrl ?? DEFAULT_ALEO_RPC_URL);
    try {
      return await client.getProgramMappingValue(params.program, params.mapping, params.key);
    } catch (err) {
      throw new NetworkError(
        `Failed to read ${params.program}/${params.mapping}[${params.key}]: ${errorMessage(err)}`,
        err,
      );
    }
  }

  /**
   * Read a Solidity mapping through its public getter. Pass the getter's
   * human-readable signature and the key(s); the decoded return value is typed
   * as `T` (defaults to `unknown` — cast or annotate at the call site).
   */
  async readEvmMapping<T = unknown>(params: EvmMappingReadParams): Promise<T> {
    if (typeof params.rpcUrl !== 'string' || params.rpcUrl.length === 0) {
      throw new ValidationError('rpcUrl must be a non-empty JSON-RPC URL.');
    }
    if (typeof params.address !== 'string' || !params.address.startsWith('0x')) {
      throw new ValidationError('address must be a 0x-prefixed contract address.');
    }
    if (typeof params.signature !== 'string' || params.signature.length === 0) {
      throw new ValidationError(
        "signature must be a getter signature, e.g. 'function balanceOf(address) view returns (uint256)'.",
      );
    }

    const viem = await loadViem();
    const abi = viem.parseAbi([params.signature]) as Abi;
    const fn = abi.find((item): item is AbiFunction => item.type === 'function');
    if (!fn) {
      throw new ValidationError(`signature must declare a function: '${params.signature}'.`);
    }

    const args = normalizeEvmKeys(params.key);
    const client = viem.createPublicClient({ transport: viem.http(params.rpcUrl) });
    try {
      const result = await client.readContract({
        address: params.address as `0x${string}`,
        abi,
        functionName: fn.name,
        args,
        ...(params.blockTag !== undefined && { blockTag: params.blockTag }),
      });
      return result as T;
    } catch (err) {
      throw new NetworkError(
        `Failed to read ${params.address}.${fn.name}(${args.join(', ')}): ${errorMessage(err)}`,
        err,
      );
    }
  }
}

/** Accept a single key or an array (nested mappings) and return a positional args array. */
function normalizeEvmKeys(key: EvmMappingKey | readonly EvmMappingKey[]): EvmMappingKey[] {
  return Array.isArray(key) ? [...(key as readonly EvmMappingKey[])] : [key as EvmMappingKey];
}

/** Lazy-load the network-specific `@provablehq/sdk` WASM build (optional peer dep). */
async function loadSdk(network: AleoNetwork): Promise<SdkModule> {
  const sub = network === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  try {
    return (await import(`@provablehq/sdk/${sub}`)) as SdkModule;
  } catch (err) {
    throw new WalletError(
      `MappingReader.readAleoMapping requires optional peer dep '@provablehq/sdk' (subpath '${sub}').`,
      err,
    );
  }
}

/** Lazy-load `viem` (optional peer dep). */
async function loadViem(): Promise<ViemModule> {
  try {
    return (await import('viem')) as ViemModule;
  } catch (err) {
    throw new WalletError(
      "MappingReader.readEvmMapping requires optional peer dep 'viem'.",
      err,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
