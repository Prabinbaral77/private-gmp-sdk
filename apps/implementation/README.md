# Implementation — `@venture23-aleo/private-gmp-sdk` tester

A small Node.js CLI that exercises every public flow exposed by
[`@venture23-aleo/private-gmp-sdk`](../../packages/private-gmp-sdk):

- **Derive** an Aleo account from a foreign-chain signer
  (`aleo` / `evm` / `solana` / `sui` / `bitcoin` / `stellar` / `stacks`).
- **Scan** owned records via the hosted indexer or the local SDK.
- **Fee-sponsor** a program call — either fully on-chain or delegated to a
  remote prover.

Use this app to smoke-test changes to the SDK without writing throw-away
scripts.

---

## 1. Prerequisites

| Tool   | Version          |
| ------ | ---------------- |
| Node   | `>= 18.17`       |
| pnpm   | `9.x` (`corepack enable && corepack prepare pnpm@9 --activate`) |
| git    | any              |

---

## 2. Clone & install

```bash
git clone <repo-url> aleo-sdk
cd aleo-sdk
pnpm install
```

`pnpm install` is run **once at the monorepo root** — it sets up
`packages/private-gmp-sdk` and `apps/implementation` together (workspace
symlinks).

---

## 3. Configure `.env`

The tester reads a single `.env` from the monorepo root. Copy the example
and fill in only the keys for the flows you intend to exercise.

```bash
cp .env.example .env
```

### Minimum to derive an Aleo account

No env vars required if you let the tester generate a fresh source key for
you. Set the per-chain key only if you want a deterministic Aleo account.

| Chain    | Env var                                       |
| -------- | --------------------------------------------- |
| `aleo`   | `ALEO_SOURCE_PRIVATE_KEY`                     |
| `evm`    | `EVM_PRIVATE_KEY`                             |
| `solana` | `SOLANA_PRIVATE_KEY_B58`                      |
| `sui`    | `SUI_PRIVATE_KEY_HEX`                         |
| `bitcoin`| `BITCOIN_WIF`                                 |
| `stellar`| `STELLAR_SECRET_KEY`                          |
| `stacks` | `STACKS_PRIVATE_KEY`                          |

### To scan records

```env
ALEO_NETWORK=testnet
ALEO_API_HOST=https://api.provable.com/v2
USER_ALEO_PRIVATE_KEY=APrivateKey1zkp...
# optional — auto-registered if omitted:
SCANNER_API_KEY=
SCANNER_CONSUMER_ID=
ALEO_SCANNER_URL=
```

### To fee-sponsor a transaction

```env
ALEO_NETWORK=testnet
ALEO_API_HOST=https://api.provable.com/v2

USER_ALEO_PRIVATE_KEY=APrivateKey1zkp...     # caller
SPONSOR_ALEO_PRIVATE_KEY=APrivateKey1zkp...  # pays the fee

# Optional — only for `sponsor:delegated`:
PROVER_URL=
PROVER_API_KEY=
PROVER_CONSUMER_ID=
```

> Never commit `.env`. The repo's `.gitignore` already excludes it.

---

## 4. Run

All commands work from the **monorepo root** *or* from `apps/implementation/`.

### Derive an Aleo account

```bash
pnpm derive --chain evm "msg"
# chains: aleo | evm | solana | sui | bitcoin | stellar | stacks
```

### Scan records

```bash
pnpm scan --mode hosted --programs credits.aleo
# --mode hosted | sdk
# --programs comma-separated list
# --limit 25  (optional)
```

### Fee-sponsored transaction — sponsor submits on-chain

```bash
pnpm sponsor:onchain \
  --program credits.aleo \
  --function transfer_public \
  --input aleo1... \
  --input 1000u64
```

### Fee-sponsored transaction — delegated to a remote prover

```bash
pnpm sponsor:delegated \
  --program credits.aleo \
  --function transfer_public \
  --input aleo1... \
  --input 1000u64
# extra flags:
#   --splitFeeAuthorization false   (use SDK's useFeeMaster path instead)
#   --broadcast false               (build only, don't broadcast)
#   --privateFee true               (pay the fee from a private record)
```

### Full help

```bash
pnpm implementation --help
```

---

## 5. Where things live

```
apps/implementation/
├── src/
│   ├── index.ts                      # CLI router
│   ├── utils.ts                      # arg parsing + dotenv loader
│   └── commands/
│       ├── derive-aleo-wallet.ts     # `derive`
│       ├── recordscanner.ts          # `scan`
│       └── fee-sponsor.ts            # `sponsor onchain | delegated`
├── package.json
├── tsconfig.json
└── README.md            ← you are here
```

The CLI imports the SDK as `@venture23-aleo/private-gmp-sdk` — that's a
pnpm workspace symlink to [`packages/private-gmp-sdk/src`](../../packages/private-gmp-sdk),
so edits to the SDK source are reflected immediately, no rebuild needed.

---

## 6. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "derive" not found` | You ran `pnpm derive` from a sibling folder. Either `cd` to the monorepo root, or `cd apps/implementation` — both have the shortcuts. |
| `Missing required env var USER_ALEO_PRIVATE_KEY` | Add it to the root `.env` and retry. |
| IDE shows red squiggles for `ethers` / `bs58` / `@solana/web3.js` after install | Stale TS server. <kbd>Cmd+Shift+P</kbd> → "TypeScript: Restart TS Server". |
| `Cannot find module '@bitcoinerlab/secp256k1'` (or `ecpair`, `bitcoinjs-lib`, `@stacks/transactions`, `@stellar/stellar-sdk`) | These are optional peer deps the SDK needs only when you derive from `bitcoin` / `stacks` / `stellar`. Install them with `pnpm --filter @venture23-aleo/private-gmp-sdk add -D <pkg>`. |
