/**
 * Public types for the cross-chain Aleo account derivation module.
 *
 * Implementation lives in {@link ../derivation}; this file holds only the
 * shapes consumers see.
 */

export type SourceChain = 'solana' | 'sui' | 'aleo' | 'evm';

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
  /** 64-byte Solana secret key (secret + pubkey concatenated). */
  readonly secretKey: Uint8Array;
};

export type SuiSignerOptions = {
  /** 32-byte ed25519 seed. */
  readonly seed: Uint8Array;
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
  /** Override the Aleo account factory (e.g. in tests). */
  readonly accountFactory?: AleoAccountFactory;
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
