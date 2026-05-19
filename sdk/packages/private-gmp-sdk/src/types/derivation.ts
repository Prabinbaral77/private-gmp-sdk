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


export type SourceChain = 'solana' | 'sui' | 'aleo' | 'evm' | 'stellar' | 'bitcoin' | 'stacks';

export type AleoNetwork = 'testnet' | 'mainnet';

/** Inputs to the pure HKDF seed derivation. */
export type DeriveAleoSeedInput = {
  readonly chain: SourceChain;
  readonly signerId: string;
  readonly signatureBytes: Uint8Array;
  readonly message: string;
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
};

/**
 * A foreign-chain message signature in the form the seed derivation consumes.
 *
 * Producers (wallets, the implementation app's signing helpers, etc.) are
 * responsible for converting their chain-native signature encoding to raw
 * bytes — the SDK no longer ships per-chain decoders.
 */
export type SignedMessage = {
  /** Stable identifier for the signer on its source chain (address / pubkey). */
  readonly signerId: string;
  /** Raw signature bytes — fed verbatim into the HKDF derivation. */
  readonly signatureBytes: Uint8Array;
  /** Human-readable signature (hex / base58 / base64) for display only. */
  readonly signatureDisplay: string;
};

/** Constructor options for {@link ../derivation/AleoAccountDeriver}. */
export type AleoAccountDeriverOptions = {
  readonly network?: AleoNetwork;
  /** Inject a custom account factory (e.g. a deterministic stub in tests). */
  readonly accountFactory?: AleoAccountFactory;
};

/** Per-call input to {@link ../derivation/AleoAccountDeriver#derive}. */
export type DeriveAleoAccountInput = {
  readonly chain: SourceChain;
  readonly signerId: string;
  readonly signatureBytes: Uint8Array;
  /** Optional human-readable form echoed back in the response; defaults to hex of `signatureBytes`. */
  readonly signatureDisplay?: string;
  readonly message: string;
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
