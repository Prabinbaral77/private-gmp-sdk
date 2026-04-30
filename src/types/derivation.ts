/**
 * Public types for the cross-chain Aleo account derivation module.
 *
 * Implementation lives in {@link ../derivation}; this file holds only the
 * shapes consumers see.
 */

// EVM-compatible chains
// 1.  Sonic
// 2.  Ethereum
// 3.  Avalanche
// 4.  BASE
// 5.  Optimism
// 6.  Arbitrum
// 7.  Polygon
// 8.  Nibiru
// 9.  Botanix
// 10. Kaia
// 11. BSC
// 12. HyperEVM
// 13. LightLink
// 14. RedBelly Network
// 15. Injective                    // Native EVM (was Cosmos, now has native EVM mainnet)

// EVM via sidechain/L2 (deploy on the EVM layer, not the native chain)
// 16. NEAR [via Aurora]            // Aurora is an EVM environment ON NEAR

// // Non-EVM chains
// 17. Stellar [Encoding=xdr]
// 18. Solana [Encoding=base58]
// 19. SUI [Encoding=utf8]
// 20. Bitcoin [Encoding=utf8]
// 21. Stacks [Encoding=stacks-consensus-buff]
// 22. Icon
// 23. Aleo


export type SourceChain = 'solana' | 'sui' | 'aleo' | 'evm' | 'stellar';

export type AleoNetwork = 'testnet' | 'mainnet';

/** Inputs to the pure HKDF seed derivation. */
export type DeriveAleoSeedInput = {
  readonly chain: SourceChain;
  readonly signerId: string;
  readonly signatureBytes: Uint8Array;
  readonly message: string;
  readonly domainSeparator?: string;
  readonly hkdfInfoUtf8?: string;
};

/** Aleo account material returned by an {@link AleoAccountFactory}. */
export type AleoAccountKeys = {
  readonly privateKey: string;
  readonly viewKey: string;
  readonly address: string;
};

/**
 * A factory that turns a 32-byte seed (or an existing private key) into a
 * concrete Aleo account. The default implementation lazy-imports
 * `@provablehq/sdk`; tests inject deterministic stubs.
 */
export type AleoAccountFactory = {
  fromSeed(seed: Uint8Array): AleoAccountKeys | Promise<AleoAccountKeys>;
  fromPrivateKey?(privateKey: string): AleoAccountKeys | Promise<AleoAccountKeys>;
  /** Sign raw bytes with a private key (or a freshly generated one). */
  sign?(
    privateKey: string | undefined,
    message: Uint8Array,
  ): Promise<{ privateKey: string; address: string; signature: string }>;
};

/** Result of a foreign-chain message signature, fed into the seed derivation. */
export type SignedMessage = {
  /** Stable identifier for the signer on its source chain (address / pubkey). */
  readonly signerId: string;
  /** Raw signature bytes — fed verbatim into the HKDF derivation. */
  readonly signatureBytes: Uint8Array;
  /** Human-readable signature (hex / base58 / base64) for display only. */
  readonly signatureDisplay: string;
};

/** A signer for one of the supported source chains. */
export type CrossChainSigner = {
  readonly chain: SourceChain;
  sign(message: string): Promise<SignedMessage>;
};

export type SolanaSignerOptions = {
  /** Base58-encoded 64-byte Solana secret key (secret + pubkey concatenated). */
  readonly secretKey: string;
};

export type SuiSignerOptions = {
  /** Hex-encoded 32-byte ed25519 seed (optional `0x` prefix). */
  readonly seed: string;
};

export type StellarSignerOptions = {
  /** Stellar StrKey-encoded ed25519 secret seed (starts with `S...`). */
  readonly secret: string;
};

export type EvmSignerOptions = {
  /** 0x-prefixed 32-byte hex private key. */
  readonly privateKey: string;
};

export type AleoSourceSignerOptions = {
  /** Optional existing source private key. If omitted, a new one is generated. */
  readonly privateKey?: string;
  /** Defaults to a `@provablehq/sdk`-backed factory for the given network. */
  readonly factory?: AleoAccountFactory;
  readonly network?: AleoNetwork;
};

export type DeriveAleoAccountOptions = {
  readonly signer: CrossChainSigner;
  readonly message: string;
  readonly network?: AleoNetwork;
  readonly domainSeparator?: string;
  readonly hkdfInfoUtf8?: string;
};

export type DerivedAleoAccount = {
  readonly source: {
    readonly chain: SourceChain;
    readonly signerId: string;
    readonly signature: string;
    readonly message: string;
  };
  readonly derivation: {
    readonly domainSeparator: string;
    readonly hkdfInfoUtf8: string;
    readonly saltSha256DomainHex: string;
    readonly seed: Uint8Array;
  };
  readonly aleo: { readonly network: AleoNetwork } & AleoAccountKeys;
};


