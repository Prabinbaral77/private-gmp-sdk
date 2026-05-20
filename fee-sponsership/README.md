# fee-sponsership-server

Express server that sponsors **delegated** Aleo executions. The client builds the program authorization locally; this server pays the fee with a sponsor account, packages a `ProvingRequest`, and submits it to a delegated proving service.

Sponsorship is gated by an **allowlist of `(program, function)` pairs** configured in [src/config.ts](src/config.ts). Anything outside the allowlist is rejected with `403`.

---

## Setup

```bash
cd fee-sponsership
npm install
cp .env.example .env
# edit .env and fill in SPONSOR_ALEO_PRIVATE_KEY (and prover credentials if you use one)
```

Edit `ALLOWED_PROGRAMS` in [src/config.ts](src/config.ts) to whitelist the programs/functions you want to sponsor. An empty map rejects every request.

### Environment variables

| Variable                       | Required | Default                       | Notes                                                       |
| ------------------------------ | -------- | ----------------------------- | ----------------------------------------------------------- |
| `SPONSOR_ALEO_PRIVATE_KEY`     | yes      | —                             | The sponsor's Aleo private key.                             |
| `ALEO_NETWORK`                 | no       | `testnet`                     | `testnet` or `mainnet`.                                     |
| `ALEO_API_HOST`                | no       | `https://api.provable.com/v2` | Aleo RPC endpoint.                                          |
| `PORT`                         | no       | `3000`                        | Port the HTTP server binds to.                              |
| `PROVER_URL`                   | no       | — (SDK default)               | Delegated proving service URL.                              |
| `PROVER_API_KEY`               | no       | —                             | Prover API key.                                             |
| `PROVER_CONSUMER_ID`           | no       | —                             | Prover consumer ID.                                         |
| `PROVER_DPS_PRIVACY`           | no       | `true`                        | Privacy flag forwarded to the prover.                       |
| `DEFAULT_PRIORITY_FEE_CREDITS` | no       | `0`                           | Used when the client does not send one.                     |
| `MAX_BASE_FEE_CREDITS`         | no       | `10`                          | Reject if the estimated base fee exceeds this.              |
| `MAX_PRIORITY_FEE_CREDITS`     | no       | `1`                           | Reject if the requested priority fee exceeds this.          |

---

## Run

```bash
npm run dev        # watch mode (tsx watch)
npm start          # one-shot (tsx)
npm run typecheck  # tsc --noEmit
```

The `@provablehq/sdk` WASM is loaded lazily on the first `/sponsor` request, so the server starts immediately and `/health` is available before any signing happens.

---

## API

### `GET /health`

Liveness probe; also returns the active allowlist so clients can introspect.

```bash
curl http://localhost:3000/health
# { "ok": true, "network": "testnet", "allowedPrograms": { "my_program.aleo": ["main"] } }
```

### `POST /sponsor`

Sponsor a delegated execution.

**Request**

```json
{
  "authorization": "<serialized Authorization>",
  "priorityFeeCredits": 0,
  "broadcast": true
}
```

| Field                | Type      | Required | Notes                                                           |
| -------------------- | --------- | -------- | --------------------------------------------------------------- |
| `authorization`      | `string`  | yes      | Output of `authorization.toString()` on the client.             |
| `priorityFeeCredits` | `number`  | no       | Defaults to `DEFAULT_PRIORITY_FEE_CREDITS`. Capped server-side. |
| `broadcast`          | `boolean` | no       | Defaults to `true`. Whether the prover should submit the tx.   |

**200 OK**

```json
{
  "sponsorAddress": "aleo1...",
  "executionId": "...",
  "entryPoint": { "programId": "my_program.aleo", "functionName": "main" },
  "transitions": [
    { "programId": "my_program.aleo", "functionName": "main" }
  ],
  "estimatedBaseFeeCredits": 0.123456,
  "priorityFeeCredits": 0,
  "broadcastRequested": true,
  "proving": { /* ProvingResponse from the delegated prover */ }
}
```

**400 Bad Request** — malformed authorization or invalid field.
**403 Forbidden** — `(program, function)` not on allowlist, or fee exceeds cap.
**500 Internal Server Error** — SDK/prover failure.

---

## Client flow

```ts
import * as sdk from '@provablehq/sdk/testnet.js';

const account = new sdk.Account({ privateKey: USER_PK });
const networkClient = new sdk.AleoNetworkClient('https://api.provable.com/v2');
const keyProvider = new sdk.AleoKeyProvider();
keyProvider.useCache(true);
const recordProvider = new sdk.NetworkRecordProvider(account, networkClient);
const pm = new sdk.ProgramManager(
  'https://api.provable.com/v2',
  keyProvider,
  recordProvider,
);
pm.setAccount(account);

// 1. Build the program authorization locally with the user's key.
const authorization = await pm.buildAuthorization({
  programName: 'my_program.aleo',
  functionName: 'main',
  inputs: ['1u32', '2u32'],
});

// 2. Hand the serialized authorization to the sponsor server.
const res = await fetch('http://localhost:3000/sponsor', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    authorization: authorization.toString(),
    broadcast: true,
  }),
});
const result = await res.json();
console.log(result.proving.transaction);
```

---

## Sponsorship policy

The server enforces policy by inspecting the deserialized `Authorization`:

1. **Allowlist** — the **entry-point** transition (the top-level call) must match a `(program, function)` pair in `ALLOWED_PROGRAMS`. Nested internal calls inside an allowed program are implicitly trusted (an allowlisted entry point commits to its entire call graph).
2. **Fee caps** — both the estimated base fee (via `estimateFeeForAuthorization`) and the client-supplied priority fee are checked against `MAX_BASE_FEE_CREDITS` / `MAX_PRIORITY_FEE_CREDITS`.
3. **Execution ID is recomputed** — the server never trusts a client-supplied execution ID; it derives one from the authorization itself before building the fee authorization.

> The `(program, function)` filter cannot be extracted from `executionId` alone — execution IDs are cryptographic hashes. The full `Authorization` is required, and `Authorization.transitions()` is walked to identify the entry point.

---

## Project layout

```
fee-sponsership/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts    # bootstrap: load config, start express
    ├── config.ts   # all config + ALLOWED_PROGRAMS constant
    ├── server.ts   # express app: routes + error handler
    ├── sponsor.ts  # FeeSponsor: deserialize auth, enforce policy, build fee auth, submit proving request
    └── types.ts    # request/response shapes + SDK type stubs
```
