# @venture23-aleo/aleo-sdk

A professional TypeScript SDK for **calling Aleo programs** and **preparing
contract-call data**, layered on top of [`@sodax/wallet-sdk`][sodax].

> Status: starter template. The encoding, validation, builder, client, and
> transaction layers are implemented and unit-tested. The Sodax wallet
> adapter targets the public Sodax wallet surface and may need a thin
> version-pin tweak depending on the `@sodax/wallet-sdk` release you ship
> against.

[sodax]: https://www.npmjs.com/package/@sodax/wallet-sdk

---

## Highlights

- **Type-safe encoding** of every Aleo primitive (`u8` … `u128`, `i8` … `i128`,
  `field`, `scalar`, `group`, `bool`, `address`, `signature`) with overflow /
  range checks.
- **ABI-aware** [`ProgramService`](src/program/ProgramService.ts) — register a
  program ABI once, then submit calls with plain JS values.
- **Fluent** [`ProgramCallBuilder`](src/program/ProgramCallBuilder.ts) for
  hand-rolled calls.
- **Wallet abstraction** ([`WalletAdapter`](src/wallet/WalletAdapter.ts)) with
  a built-in [`SodaxWalletAdapter`](src/wallet/WalletAdapter.ts) and an
  `InMemoryWalletAdapter` for tests.
- **Network layer** that polls the Aleo public RPC for receipt finalization.
- **First-class DX**: strict TS config, ESLint + Prettier, Vitest with coverage
  thresholds, GitHub Actions CI matrix on Node 18 / 20 / 22.

---

## Install

```bash
npm install @venture23-aleo/aleo-sdk @sodax/wallet-sdk
```

> Requires Node ≥ 18.17.

---

## Quick start

```ts
import {
  AleoClient,
  SodaxWalletAdapter,
  type ProgramAbi,
} from '@venture23-aleo/aleo-sdk';
// import { createSodaxWallet } from '@sodax/wallet-sdk';

const creditsAbi: ProgramAbi = {
  id: 'credits.aleo',
  functions: [
    {
      name: 'transfer_public',
      inputs: [
        { name: 'recipient', type: 'address', visibility: 'public' },
        { name: 'amount',    type: 'u64',     visibility: 'public' },
      ],
      outputs: [{ type: 'future', visibility: 'public' }],
    },
  ],
};

const sodaxWallet = /* await createSodaxWallet({ ... }) */;

const client = new AleoClient({
  network: 'testnet',
  wallet: new SodaxWalletAdapter(sodaxWallet),
  programAbis: [creditsAbi],
});

const receipt = await client.call({
  programId: 'credits.aleo',
  functionName: 'transfer_public',
  inputs: ['aleo1abc...xyz', 1_000_000n],   // address + microcredits
  fee: 300_000n,
});

console.log(receipt.status); // 'finalized' | 'accepted' | ...
```

### Three levels of usage

| Level                | What you call                                | When to use                                                                  |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. `client.prepare`  | Pure data preparation, no IO                 | Server-side payload generation, dry-runs, unit tests.                        |
| 2. `client.submit`   | Prepare → wallet sign → broadcast            | Fire-and-forget submission; you get a tx id back.                            |
| 3. `client.call`     | Submit → poll RPC until finalized / failed   | Full round-trip when you need to know the on-chain outcome.                  |

---

## Project layout

```
.
├── src/
│   ├── client/               # AleoClient — top-level facade
│   ├── program/              # Builders + ABI-aware ProgramService
│   ├── transaction/          # Receipt polling against Aleo RPC
│   ├── encoding/             # Aleo type encoders & decoders
│   ├── wallet/               # WalletAdapter + Sodax/in-memory implementations
│   ├── types/                # Branded types and ABI shapes
│   ├── utils/                # Errors, logger, validation helpers
│   ├── config/               # Network presets (mainnet / testnet / localnet)
│   └── index.ts              # Public barrel
├── tests/
│   ├── unit/                 # Encoding, builder, validation, wallet
│   ├── integration/          # AleoClient end-to-end with mocked fetch
│   ├── fixtures/             # Sample ABIs and addresses
│   └── setup.ts              # Vitest hooks
├── examples/                 # Runnable examples (tsx)
├── .github/workflows/ci.yml  # Lint + typecheck + test + build matrix
├── tsconfig.json             # Strict TS config
├── tsup.config.ts            # ESM + CJS dual build
├── vitest.config.ts          # Coverage thresholds (80%)
└── package.json
```

---

## Scripts

| Command                   | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `npm run build`           | Build dual ESM + CJS bundles via `tsup`            |
| `npm run dev`             | `tsup` in watch mode                               |
| `npm run typecheck`       | `tsc --noEmit`                                     |
| `npm run lint` / `lint:fix` | ESLint                                          |
| `npm run format`          | Prettier write                                     |
| `npm run test`            | Vitest run (unit + integration)                    |
| `npm run test:watch`      | Vitest in watch mode                               |
| `npm run test:coverage`   | Vitest with V8 coverage and 80% thresholds         |
| `npm run example:basic`   | Run `examples/basic-call.ts`                       |
| `npm run example:transfer`| Run `examples/transfer.ts`                         |
| `npm run prepublishOnly`  | Clean → lint → typecheck → test → build            |

---

## Encoding cheatsheet

```ts
import {
  encodePrimitive,
  encodeStruct,
  encodeAuto,
} from '@venture23-aleo/aleo-sdk/encoding';

encodePrimitive(42, 'u64');                 // "42u64"
encodePrimitive(-1, 'i32');                 // "-1i32"
encodePrimitive('aleo1...', 'address');     // "aleo1..." (validated)
encodePrimitive(true, 'bool');              // "true"

encodeStruct(
  { recipient: 'aleo1...', amount: 1n },
  { recipient: 'address', amount: 'u64' },
);
// "{ recipient: aleo1..., amount: 1u64 }"

encodeAuto(10);   // "10u64"  (best-effort fallback)
encodeAuto(10n);  // "10u128"
```

---

## Wallet integration

The SDK depends on a small `WalletAdapter` interface — anything that can
return an address and sign+broadcast a `PreparedProgramCall` works.

```ts
export interface WalletAdapter {
  readonly name: string;
  getAddress(): Promise<AleoAddress>;
  signAndBroadcast(call: PreparedProgramCall): Promise<TransactionBroadcastResult>;
  signMessage?(message: string): Promise<string>;
  disconnect?(): Promise<void>;
}
```

`SodaxWalletAdapter` ships out of the box. If `@sodax/wallet-sdk` exposes
extra methods you want to surface, subclass it or build your own adapter —
the SDK will accept it the same way.

For tests, use `InMemoryWalletAdapter` to avoid mocking the wallet at all.

---

## Configuration

Network presets live in [src/config/networks.ts](src/config/networks.ts).
Pass either a preset name (`'mainnet' | 'testnet' | 'localnet'`) or a full
`NetworkConfig` to `AleoClient`.

Example overrides via env (loaded by `examples/transfer.ts`):

```bash
cp .env.example .env
# then edit .env
```

---

## Testing strategy

- **Unit tests** ([tests/unit](tests/unit)) cover encoding edge cases,
  validation, builders, and the wallet adapters.
- **Integration tests** ([tests/integration](tests/integration)) exercise
  `AleoClient` end-to-end with a mocked `fetch` so they are deterministic and
  CI-safe.
- Coverage thresholds (lines / functions / statements 80, branches 75) are
  enforced via [vitest.config.ts](vitest.config.ts).

```bash
npm run test:coverage
```

---

## Development

```bash
nvm use                # picks up .nvmrc
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

CI runs the same set across Node 18 / 20 / 22 via
[.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## License

[MIT](LICENSE).
