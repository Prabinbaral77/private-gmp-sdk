import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { loadDotenv } from '../src/utils.js';

const PROGRAM_NAME = 'sample_program.aleo';
const FUNCTION_NAME = 'main';
const INPUTS = ['1u32', '2u32'] as const;

const SPONSOR_URL = process.env['FEE_SPONSOR_URL'] ?? 'http://localhost:3030';

type HealthResponse = {
  ok: boolean;
  network: 'testnet' | 'mainnet';
  authConfigured: boolean;
  maxBaseFeeCredits: number;
  maxPriorityFeeCredits: number;
};

type FeeAuthResponse = {
  sponsorAddress: string;
  executionId: string;
  baseFeeCredits: number;
  priorityFeeCredits: number;
  feeAuthorization: string;
};

async function getHealth(): Promise<HealthResponse | undefined> {
  try {
    const res = await fetch(`${SPONSOR_URL}/health`);
    if (!res.ok) return undefined;
    return (await res.json()) as HealthResponse;
  } catch {
    return undefined;
  }
}

async function loadSdk() {
  const network = process.env['ALEO_NETWORK'] === 'mainnet' ? 'mainnet.js' : 'testnet.js';
  return import(`@provablehq/sdk/${network}`);
}

type ClientContext = {
  sdk: any;
  pm: any;
  networkClient: any;
  authorization: any;
  executionId: string;
  baseFeeCredits: number;
};

async function buildClientContext(): Promise<ClientContext> {
  const sdk: any = await loadSdk();
  const host = process.env['ALEO_API_HOST'] ?? 'https://api.provable.com/v2';
  const userPk = process.env['USER_ALEO_PRIVATE_KEY'];
  if (!userPk) throw new Error('USER_ALEO_PRIVATE_KEY is required');

  const account = new sdk.Account({ privateKey: userPk });
  const networkClient = new sdk.AleoNetworkClient(host);
  const keyProvider = new sdk.AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new sdk.NetworkRecordProvider(account, networkClient);
  const pm = new sdk.ProgramManager(host, keyProvider, recordProvider);
  pm.setAccount(account);

  const authorization = await pm.buildAuthorization({
    programName: PROGRAM_NAME,
    functionName: FUNCTION_NAME,
    inputs: [...INPUTS],
  });
  const executionId: string = authorization.toExecutionId().toString();
  const baseFeeMicro: bigint = await pm.estimateFeeForAuthorization({
    programName: PROGRAM_NAME,
    authorization,
  });
  const baseFeeCredits = Number(baseFeeMicro) / 1_000_000;

  return { sdk, pm, networkClient, authorization, executionId, baseFeeCredits };
}

function apiKey(): string | undefined {
  return process.env['FEE_SPONSOR_API_KEY'];
}

// Integration test: hits the fee-sponsership server's /fee-authorization endpoint.
//
// The server never sees the program authorization. The client (this test):
//   1. Builds the authorization locally with USER_ALEO_PRIVATE_KEY.
//   2. Computes executionId locally.
//   3. Estimates baseFee locally.
//   4. Sends { executionId, baseFeeCredits, priorityFeeCredits } + API key to the server.
//   5. Receives a signed feeAuthorization back.
//   6. Assembles ProvingRequest.new(authorization, feeAuthorization, broadcast).
//   7. Optionally submits the ProvingRequest to the delegated prover (if PROVER_URL is set).
//
// Prerequisites:
//   1. Server running and reachable at FEE_SPONSOR_URL (default http://localhost:3030).
//   2. FEE_SPONSOR_API_KEY env var set to one of the server's API_KEYS.
//   3. USER_ALEO_PRIVATE_KEY env var set (the user that authorizes the call).
//   4. `${PROGRAM_NAME}` deployed on the network the server is talking to.
//   5. (Optional) PROVER_URL / PROVER_API_KEY / PROVER_CONSUMER_ID to actually submit.
//
// Auto-skips if the server is unreachable or required env is missing.
describe('fee sponsorship (privacy-preserving): /fee-authorization → ProvingRequest', () => {
  before(() => {
    loadDotenv();
  });

  it('client builds authorization locally; server signs fee; client assembles ProvingRequest', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    if (!health.authConfigured) {
      t.skip('server has no API_KEYS configured');
      return;
    }
    if (!apiKey()) {
      t.skip('FEE_SPONSOR_API_KEY is not set');
      return;
    }
    if (!process.env['USER_ALEO_PRIVATE_KEY']) {
      t.skip('USER_ALEO_PRIVATE_KEY is not set');
      return;
    }

    const ctx = await buildClientContext();
    console.log('Client context built:', {
      executionId: ctx.executionId,
      baseFeeCredits: ctx.baseFeeCredits,
    });
    assert.equal(typeof ctx.executionId, 'string');
    assert.ok(ctx.executionId.length > 0, 'executionId is non-empty');
    assert.ok(ctx.baseFeeCredits > 0, 'baseFee should be positive');
    assert.ok(
      ctx.baseFeeCredits <= health.maxBaseFeeCredits,
      `client base fee ${ctx.baseFeeCredits} must be <= server cap ${health.maxBaseFeeCredits}`,
    );
    const res = await fetch(`${SPONSOR_URL}/fee-authorization`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        executionId: ctx.executionId,
        baseFeeCredits: ctx.baseFeeCredits,
        priorityFeeCredits: 0,
      }),
    });

    const body = (await res.json()) as FeeAuthResponse | { error: string };
    assert.equal(
      res.status,
      200,
      `expected 200, got ${res.status}: ${JSON.stringify(body)}`,
    );

    const ok = body as FeeAuthResponse;
    console.log('Fee-authorization response:', {
      sponsorAddress: ok.sponsorAddress,
      executionId: ok.executionId,
      baseFeeCredits: ok.baseFeeCredits,
      priorityFeeCredits: ok.priorityFeeCredits,
    });

    assert.equal(ok.executionId, ctx.executionId, 'echoed executionId must match');
    assert.equal(ok.baseFeeCredits, ctx.baseFeeCredits);
    assert.equal(ok.priorityFeeCredits, 0);
    assert.equal(typeof ok.sponsorAddress, 'string');
    assert.ok(ok.sponsorAddress.startsWith('aleo1'), 'sponsorAddress is an Aleo address');
    assert.equal(typeof ok.feeAuthorization, 'string');
    assert.ok(ok.feeAuthorization.length > 0, 'feeAuthorization must be non-empty');

    // Client assembles the ProvingRequest from the server-signed fee authorization.
    const feeAuthObj = ctx.sdk.Authorization.fromString(ok.feeAuthorization);
    const broadcast = (process.env['PROVER_BROADCAST'] ?? 'true').toLowerCase() !== 'false';
    const provingRequest = ctx.sdk.ProvingRequest.new(ctx.authorization, feeAuthObj, broadcast);
    assert.ok(provingRequest, 'ProvingRequest constructed');
    const serialized = provingRequest.toString();
    assert.equal(typeof serialized, 'string');
    assert.ok(serialized.length > 0, 'ProvingRequest serializes to a non-empty string');

    // If a delegated prover is configured, actually submit it end-to-end.
    const proverUrl = process.env['PROVER_URL'];
    if (!proverUrl) {
      console.log('PROVER_URL not set — skipping live proving submission.');
      return;
    }
    const submitArgs: Record<string, unknown> = { provingRequest, url: proverUrl };
    if (process.env['PROVER_API_KEY']) submitArgs['apiKey'] = process.env['PROVER_API_KEY'];
    if (process.env['PROVER_CONSUMER_ID']) {
      submitArgs['consumerId'] = process.env['PROVER_CONSUMER_ID'];
    }
    if (process.env['PROVER_DPS_PRIVACY']) {
      submitArgs['dpsPrivacy'] =
        process.env['PROVER_DPS_PRIVACY']!.toLowerCase() !== 'false';
    }
    const proving = await ctx.networkClient.submitProvingRequest(submitArgs);
    assert.ok(proving, 'proving response present');
  });

  it('/fee-authorization rejects requests without an API key', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    const res = await fetch(`${SPONSOR_URL}/fee-authorization`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ executionId: 'whatever', baseFeeCredits: 0.01 }),
    });
    assert.equal(res.status, 401, `expected 401 for missing API key, got ${res.status}`);
  });

  it('/fee-authorization rejects malformed body (missing executionId)', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    if (!apiKey()) {
      t.skip('FEE_SPONSOR_API_KEY is not set');
      return;
    }
    const res = await fetch(`${SPONSOR_URL}/fee-authorization`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({ baseFeeCredits: 0.01 }),
    });
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 400, `expected 400 for missing executionId, got ${res.status}`);
    assert.match(body.error ?? '', /executionId/i);
  });

  it('/fee-authorization rejects baseFeeCredits over the server cap', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    if (!apiKey()) {
      t.skip('FEE_SPONSOR_API_KEY is not set');
      return;
    }
    const res = await fetch(`${SPONSOR_URL}/fee-authorization`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        executionId: '0field',
        baseFeeCredits: health.maxBaseFeeCredits + 1,
      }),
    });
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 403, `expected 403 for fee over cap, got ${res.status}`);
    assert.match(body.error ?? '', /baseFeeCredits/i);
  });
});
