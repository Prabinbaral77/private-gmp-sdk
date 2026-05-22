# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

pnpm monorepo (`packageManager: pnpm@9.0.0`, `node >= 18.17`). `pnpm-workspace.yaml` includes `packages/*` and `apps/*`.

- `packages/private-gmp-sdk` — the published library (`@venture23-aleo/private-gmp-sdk`). Built with `tsup` → dual ESM/CJS in `dist/`.
- `apps/implementation` — internal CLI (`@venture23-aleo/implementation`) that exercises every public SDK flow via `tsx`. Not published.

## Commands

Run from the monorepo root unless noted. The root `package.json` exposes shortcuts that delegate to the implementation app.

```bash
pnpm install                              # one-shot; sets up workspace symlinks
pnpm build                                # tsup build for every packages/* (NOT apps/*)
pnpm typecheck                            # tsc --noEmit recursively
pnpm lint                                 # eslint recursively
pnpm format                               # prettier --write across the tree

pnpm derive --chain evm "msg"             # CLI: derive Aleo account from foreign signer
pnpm scan --mode hosted --programs credits.aleo
pnpm implementation --help                # full CLI help
```

The implementation CLI loads env from `apps/implementation/.env` first, then `$CWD/.env`. There is no root `.env` in use, despite what some docs say.

## Critical: SDK edits require a rebuild for runtime

The implementation's `tsconfig.json` path-maps `@venture23-aleo/private-gmp-sdk` → `packages/private-gmp-sdk/src/index.ts`, so **typecheck** uses the live source. But `tsx` at **runtime** follows pnpm's symlink to the package, which resolves via `package.json#main`/`module` to `dist/index.cjs` / `dist/index.js`.

**Result:** edits to `packages/private-gmp-sdk/src/**` won't be exercised by `pnpm scan` / `pnpm derive` until you rebuild:

```bash
pnpm --filter @venture23-aleo/private-gmp-sdk run build
```

The package README claims "edits to the SDK source are reflected immediately, no rebuild needed" — that's only true for typecheck/IDE. Don't trust a fixed-in-src bug as fixed at runtime until `dist/` is regenerated.

## SDK architecture

`packages/private-gmp-sdk/src/index.ts` is a barrel re-exporting every module. The public surface area is grouped by capability:

- `scanner/scanner.ts` — `RecordScannerService` with `hosted()` (Provable indexer) and `sdk()` (direct via `NetworkRecordProvider`) modes. Hosted mode auto-registers a consumer if `apiKey`/`consumerId` are missing.
- `derivation/` — `deriveAleoAccount({ signer, message, network })` plus per-chain signers under `derivation/signers/` (`aleo`, `evm`, `solana`, `sui`, `bitcoin`, `stellar`, `stacks`). Backed by `createProvableHqAccountFactory`.
- `encoding/`, `program/`, `transaction/`, `client/`, `wallet/`, `types/`, `utils/`, `config/`, `constants/` — supporting layers. `types/` is re-exported under its own subpath (`@venture23-aleo/private-gmp-sdk/types`) as is `encoding/` and `derivation/` (see `tsup.config.ts#entry`).

### `@provablehq/sdk` is loaded dynamically per-network

The SDK ships ESM subpaths for testnet and mainnet WASM. Services that need it never import statically — they call:

```ts
await import(`@provablehq/sdk/${network === 'mainnet' ? 'mainnet.js' : 'testnet.js'}`)
```

inside a `loadSdk()` / `loadProvableHq()` helper, then cache the module promise. This is why `@provablehq/sdk` is declared as a **peer dep** in `packages/private-gmp-sdk/package.json` (with `peerDependenciesMeta.optional: true`) and a `WalletError` is thrown if the import fails. When adding a new flow that touches SnarkVM/WASM, follow the same lazy-load pattern — don't add a top-level import.

Other chain SDKs (`ethers`, `@solana/web3.js`, `bitcoinjs-lib`, `@stacks/transactions`, `@stellar/stellar-sdk`, `bs58`, `tweetnacl`, `@bitcoinerlab/secp256k1`, `ecpair`) are also peer deps with the same opt-in pattern — only consumers that exercise that derivation chain need to install them.

### Path alias

SDK source uses `@/*` → `src/*` (see `packages/private-gmp-sdk/tsconfig.json#paths`). The implementation app's tsconfig also defines `@/*` → `packages/private-gmp-sdk/src/*` so it can reach internal SDK paths during typecheck — don't use that alias in app code outside of debugging.

## TypeScript strictness

`packages/private-gmp-sdk/tsconfig.json` enables every strict flag, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. When adding optional config to a public type, use `key?: T` and conditional spread (`...(value !== undefined && { key: value })`) rather than `key: T | undefined`, to satisfy `exactOptionalPropertyTypes`.

## Build outputs

`tsup` emits four entrypoints (see `tsup.config.ts#entry`): `index`, `encoding/index`, `types/index`, `derivation/index`. If you add a new public subpath, register it both in `tsup.config.ts#entry` and in `package.json#exports`.
