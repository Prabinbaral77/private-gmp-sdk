import type { AleoNetwork } from '@/types/derivation';

/**
 * Public types for the generic mapping reader (`@/mappings/mapping-reader`).
 * One unified `MappingReader` reads on-chain key/value state from both Aleo
 * programs and Solidity contracts; these are the shapes its methods accept.
 */

/** A Solidity mapping key — anything viem can ABI-encode for the getter's input. */
export type EvmMappingKey = string | number | bigint | boolean;

/** Block selector for an EVM read; defaults to the latest block when omitted. */
export type EvmBlockTag = 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';

/**
 * Arguments to read a single Aleo program mapping value. Resolves
 * `program/mapping[key]` to the stored value as an Aleo literal string, e.g.
 * reading `credits.aleo`'s `account` mapping at an address returns `"100u64"`.
 */
export interface AleoMappingReadParams {
  /** Aleo network — selects which `@provablehq/sdk` WASM build is lazy-loaded. */
  readonly network: AleoNetwork;
  /** Program id, e.g. `credits.aleo`. */
  readonly program: string;
  /** Mapping name declared in the program, e.g. `account`. */
  readonly mapping: string;
  /** Mapping key as an Aleo literal string, e.g. an address or `123field`. */
  readonly key: string;
  /** Node RPC base URL. Defaults to {@link DEFAULT_ALEO_RPC_URL}. */
  readonly rpcUrl?: string;
}

/**
 * Arguments to read a Solidity mapping via its auto-generated public getter.
 * A `mapping(K => V) public m` compiles to a view function `m(K) returns (V)`,
 * so pass that getter's human-readable signature plus the key(s).
 */
export interface EvmMappingReadParams {
  /** EVM JSON-RPC endpoint URL. */
  readonly rpcUrl: string;
  /** Deployed contract address (`0x`-prefixed). */
  readonly address: string;
  /**
   * Human-readable getter signature, e.g.
   * `function balanceOf(address) view returns (uint256)`. The function name is
   * taken from here, so there's no separate `mapping` field.
   */
  readonly signature: string;
  /**
   * Mapping key. For a single-key mapping pass the key directly; for nested
   * mappings (`mapping(a => mapping(b => c))`) pass the keys as an array.
   */
  readonly key: EvmMappingKey | readonly EvmMappingKey[];
  /** Block to read at. Defaults to `latest`. */
  readonly blockTag?: EvmBlockTag;
}
