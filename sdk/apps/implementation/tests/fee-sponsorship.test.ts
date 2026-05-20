import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { loadDotenv } from '../src/utils.js';

const PROGRAM_NAME = 'sample_program.aleo';
const FUNCTION_NAME = 'main';
const INPUTS = ['1u32', '2u32'] as const;

const SPONSOR_URL = process.env['FEE_SPONSOR_URL'] ?? 'http://localhost:3030';

type SponsorResponse = {
  sponsorAddress: string;
  executionId: string;
  entryPoint: { programId: string; functionName: string };
  transitions: ReadonlyArray<{ programId: string; functionName: string }>;
  estimatedBaseFeeCredits: number;
  priorityFeeCredits: number;
  broadcastRequested: boolean;
  proving: unknown;
};

type HealthResponse = {
  ok: boolean;
  network: 'testnet' | 'mainnet';
  allowedPrograms: Record<string, string[]>;
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

async function buildAuthorizationString(): Promise<string> {
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
  return authorization.toString();
}

// Integration test: hits the fee-sponsership server over HTTP.
//
// Prerequisites:
//   1. The fee-sponsership server is running and reachable at FEE_SPONSOR_URL
//      (defaults to http://localhost:3030).
//   2. The server's ALLOWED_PROGRAMS in src/config.ts includes
//      `${PROGRAM_NAME}: ['${FUNCTION_NAME}']`.
//   3. USER_ALEO_PRIVATE_KEY env var is set (the user that authorizes the call).
//   4. `${PROGRAM_NAME}` is deployed on the network the server is talking to.
//
// The test is auto-skipped if the server is unreachable so it does not
// block local typecheck/unit-test runs.
describe('fee sponsorship: sample_program.aleo/main(1u32, 2u32)', () => {
  before(() => {
    loadDotenv();
  });

  it('POST /sponsor returns a signed/submitted proving response', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    const allowed = health.allowedPrograms?.[PROGRAM_NAME];
    if (!allowed?.includes(FUNCTION_NAME)) {
      t.skip(
        `server allowlist does not include ${PROGRAM_NAME}/${FUNCTION_NAME}; ` +
          `add it to ALLOWED_PROGRAMS in fee-sponsership/src/config.ts`,
      );
      return;
    }
    if (!process.env['USER_ALEO_PRIVATE_KEY']) {
      t.skip('USER_ALEO_PRIVATE_KEY is not set');
      return;
    }

    const authorization = await buildAuthorizationString();

    const res = await fetch(`${SPONSOR_URL}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authorization, broadcast: true }),
    });

    const body = (await res.json()) as SponsorResponse | { error: string };
    assert.equal(
      res.status,
      200,
      `expected 200, got ${res.status}: ${JSON.stringify(body)}`,
    );
    console.log("Sponsor response:", body);
    const ok = body as SponsorResponse;
    assert.equal(ok.entryPoint.programId, PROGRAM_NAME);
    assert.equal(ok.entryPoint.functionName, FUNCTION_NAME);
    assert.ok(
      ok.transitions.some(
        (t) => t.programId === PROGRAM_NAME && t.functionName === FUNCTION_NAME,
      ),
      'transitions must contain the entry point',
    );
    assert.equal(typeof ok.executionId, 'string');
    assert.ok(ok.executionId.length > 0, 'executionId is non-empty');
    assert.equal(typeof ok.sponsorAddress, 'string');
    assert.ok(ok.sponsorAddress.startsWith('aleo1'), 'sponsorAddress is an Aleo address');
    assert.equal(typeof ok.estimatedBaseFeeCredits, 'number');
    assert.ok(ok.estimatedBaseFeeCredits > 0, 'estimated base fee > 0');
    assert.equal(ok.broadcastRequested, true);
    assert.ok(ok.proving, 'proving response present');
  });

  it('POST /sponsor rejects when an extra field forces the allowlist check', async (t) => {
    const health = await getHealth();
    if (!health) {
      t.skip(`fee-sponsership server not reachable at ${SPONSOR_URL}`);
      return;
    }
    const res = await fetch(`${SPONSOR_URL}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authorization: '' }),
    });
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 400, `expected 400 for empty authorization, got ${res.status}`);
    assert.match(body.error ?? '', /authorization/i);
  });
});
