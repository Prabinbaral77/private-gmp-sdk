# fee-sponsership-server

Express server that signs **fee authorizations** for sponsored Aleo executions.

The server **never sees the program authorization** — the client builds the authorization, computes the execution ID, and estimates the base fee locally; the server only signs a fee authorization for that `executionId` and returns it. The client then assembles the `ProvingRequest` and submits it to the prover directly.

This trades the per-`(program, function)` allowlist for **caller authentication + fee caps**. Use this when callers are trusted (your own backend, partner services, API-key holders), not for an open public endpoint.

---

## Setup

```bash
cd fee-sponsership
npm install
cp .env.example .env
# edit .env: set SPONSOR_ALEO_PRIVATE_KEY and API_KEYS (comma-separated)
```

### Environment variables

| Variable                       | Required | Default                       | Notes                                                       |
| ------------------------------ | -------- | ----------------------------- | ----------------------------------------------------------- |
| `SPONSOR_ALEO_PRIVATE_KEY`     | yes      | —                             | The sponsor's Aleo private key.                             |
| `API_KEYS`                     | yes      | —                             | Comma-separated list of accepted bearer keys.               |
| `ALEO_NETWORK`                 | no       | `testnet`                     | `testnet` or `mainnet`.                                     |
| `ALEO_API_HOST`                | no       | `https://api.provable.com/v2` | Aleo RPC endpoint.                                          |
| `PORT`                         | no       | `3000`                        | Port the HTTP server binds to.                              |
| `DEFAULT_PRIORITY_FEE_CREDITS` | no       | `0`                           | Used when the client does not send one.                     |
| `MAX_BASE_FEE_CREDITS`         | no       | `10`                          | Reject if the client-supplied base fee exceeds this.        |
| `MAX_PRIORITY_FEE_CREDITS`     | no       | `1`                           | Reject if the client-supplied priority fee exceeds this.    |

If `API_KEYS` is empty, every request is rejected with `401`.

---

## Run

```bash
npm run dev        # watch mode (tsx watch)
npm start          # one-shot (tsx)
npm run typecheck  # tsc --noEmit
```

---

## API

### `GET /health`

```bash
curl http://localhost:3000/health
# {
#   "ok": true,
#   "network": "testnet",
#   "authConfigured": true,
#   "maxBaseFeeCredits": 10,
#   "maxPriorityFeeCredits": 1
# }
```

### `POST /fee-authorization`

Sign a fee authorization for a client-supplied `executionId`.

**Headers**

```
Authorization: Bearer <api-key>      # or: x-api-key: <api-key>
Content-Type: application/json
```

**Request**

```json
{
  "executionId": "<authorization.toExecutionId().toString()>",
  "baseFeeCredits": 0.123456,
  "priorityFeeCredits": 0
}
```

| Field                | Type     | Required | Notes                                                            |
| -------------------- | -------- | -------- | ---------------------------------------------------------------- |
| `executionId`        | `string` | yes      | Computed client-side from the program authorization.             |
| `baseFeeCredits`     | `number` | yes      | Computed client-side via `estimateFeeForAuthorization`. Capped.  |
| `priorityFeeCredits` | `number` | no       | Defaults to `DEFAULT_PRIORITY_FEE_CREDITS`. Capped.              |

**200 OK**

```json
{
  "sponsorAddress": "aleo1...",
  "executionId": "...",
  "baseFeeCredits": 0.123456,
  "priorityFeeCredits": 0,
  "feeAuthorization": "<serialized Authorization — pass to ProvingRequest.new>"
}
```

**400 Bad Request** — malformed field.
**401 Unauthorized** — missing or invalid API key.
**403 Forbidden** — fee exceeds cap.
**500 Internal Server Error** — SDK failure.

---

## Client flow

```ts
import * as sdk from '@provablehq/sdk/testnet.js';

const account = new sdk.Account({ privateKey: USER_PK });
const networkClient = new sdk.AleoNetworkClient('https://api.provable.com/v2');
const keyProvider = new sdk.AleoKeyProvider();
keyProvider.useCache(true);
const recordProvider = new sdk.NetworkRecordProvider(account, networkClient);
const pm = new sdk.ProgramManager('https://api.provable.com/v2', keyProvider, recordProvider);
pm.setAccount(account);

// 1. Build authorization, executionId, and estimate the base fee — all client-side.
const authorization = await pm.buildAuthorization({
  programName: 'my_program.aleo',
  functionName: 'main',
  inputs: ['1u32', '2u32'],
});
const executionId = authorization.toExecutionId().toString();
const baseFeeMicrocredits = await pm.estimateFeeForAuthorization({
  programName: 'my_program.aleo',
  authorization,
});
const baseFeeCredits = Number(baseFeeMicrocredits) / 1_000_000;

// 2. Ask the sponsor to sign a fee for this executionId. The authorization stays local.
const res = await fetch('http://localhost:3000/fee-authorization', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({ executionId, baseFeeCredits, priorityFeeCredits: 0 }),
});
const { feeAuthorization } = await res.json();

// 3. Assemble and submit the ProvingRequest yourself.
const feeAuth = sdk.Authorization.fromString(feeAuthorization);
const provingRequest = sdk.ProvingRequest.new(authorization, feeAuth, /* broadcast */ true);
const proving = await networkClient.submitProvingRequest({
  provingRequest,
  url: PROVER_URL,
  apiKey: PROVER_API_KEY,
  consumerId: PROVER_CONSUMER_ID,
});
console.log(proving.transaction);
```

---

## Security model

| Threat                                 | Mitigation                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Server learns user's program / inputs  | Server only receives `executionId` (an opaque hash); the authorization never leaves the client.             |
| Unauthorized caller drains sponsor     | API key required; rotate by editing `API_KEYS`. Add a rate limiter / per-key budget in front for production. |
| Caller requests an absurdly high fee   | `MAX_BASE_FEE_CREDITS` / `MAX_PRIORITY_FEE_CREDITS` cap each call.                                          |
| Caller requests a fee for any program  | **Accepted by design.** The server cannot tell what `executionId` corresponds to. The trust comes from the API key — only issue keys to callers you trust. |

If you need to constrain *what* programs may be sponsored, the server has to see the authorization — that's a different model and reintroduces the privacy leak you wanted to avoid.

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
    ├── config.ts   # env + API_KEYS parsing
    ├── server.ts   # express app: /health, /fee-authorization, error handler
    ├── sponsor.ts  # FeeSponsor: authenticate, cap fees, build fee authorization
    └── types.ts    # request/response shapes + SDK type stubs
```
