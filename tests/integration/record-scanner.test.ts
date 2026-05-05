import { describe, expect, it } from 'vitest';

import { RecordScannerService } from '@/scanner/scanner';
import { ALEO_TESTNET_PRIVATE_KEY } from '../fixtures/derivation-vectors';

const LIVE = ALEO_TESTNET_PRIVATE_KEY.length > 0;
const NETWORK_TIMEOUT_MS = 120_000;

const SCANNER_URL = process.env.RECORD_SCANNER_URL ?? 'https://api.provable.com/scanner';
const RPC_HOST = process.env.ALEO_API_HOST ?? 'https://api.explorer.aleo.org/v1';

const describeLive = LIVE ? describe : describe.skip;

describeLive('RecordScannerService — live testnet', () => {
  let customerUuid: string ;
  let customerApiKey: string;
  describe('hosted mode', () => {
    it("Should create the customer and return the credentials", async () => {
      const service = new RecordScannerService({
        network: 'testnet',
        privateKey: ALEO_TESTNET_PRIVATE_KEY,
        scannerUrl: SCANNER_URL,
        host: RPC_HOST,
      });

      const credentials = await service.getCredentials();
      customerUuid = credentials.consumerId;
      customerApiKey = credentials.apiKey;
      expect(credentials).toHaveProperty('apiKey');
      expect(credentials).toHaveProperty('consumerId');
      expect(typeof credentials.apiKey).toBe('string');
      expect(typeof credentials.consumerId).toBe('string');
    });

    it(
      'Scanned owned credits.aleo records',
      async () => {
        const service = new RecordScannerService({
          network: 'testnet',
          privateKey: ALEO_TESTNET_PRIVATE_KEY,
          scannerUrl: SCANNER_URL,
          host: RPC_HOST,
        });

        const result = await service.hosted({
          programs: ['credits.aleo'],
          startBlock: 0,
          endBlock: 100000,
          limit: 5,
          apiKey: customerApiKey,
          consumerId: customerUuid,
        });
        console.log('Hosted scan result:', result);

        expect(result.mode).toBe('hosted');
        expect(typeof result.registration?.uuid).toBe('string');
        expect(result.registration?.uuid?.length).toBeGreaterThan(0);
        expect(Array.isArray(result.records)).toBe(true);
        expect(result.records.length).toBeLessThanOrEqual(5);
        for (const record of result.records) {
          expect(record.program_name).toBe('credits.aleo');
        }
      },
      NETWORK_TIMEOUT_MS,
    );

    it.skip(
      'reuses provided apiKey/consumerId without creating a new consumer',
      async () => {
        const services = new RecordScannerService({
          network: 'testnet',
          privateKey: ALEO_TESTNET_PRIVATE_KEY,
          scannerUrl: SCANNER_URL,
          host: RPC_HOST
        });

        const result = await services.hosted({ programs: ['credits.aleo'], limit: 1, apiKey: customerApiKey, consumerId: customerUuid });
        expect(result.mode).toBe('hosted');
        // console.log('Hosted scan result with same provided credentials:', result);
      },
      NETWORK_TIMEOUT_MS,
    );
  });

  describe('sdk mode', () => {
    it(
      'queries credits.aleo records via the public Aleo node',
      async () => {
        const service = new RecordScannerService({
          network: 'testnet',
          privateKey: ALEO_TESTNET_PRIVATE_KEY
        });

        const result = await service.sdk({
          programs: ['credits.aleo'],
          startBlock: 0,
          endBlock: 100000,
          limit: 5,
          apiKey: customerApiKey,
          consumerId: customerUuid,
        });

        console.log('SDK scan result:', result);
        expect(result.mode).toBe('sdk');
        expect(Array.isArray(result.records)).toBe(true);
        expect(result.records.length).toBeLessThanOrEqual(5);
        for (const record of result.records) {
          expect(record.program_name).toBe('credits.aleo');
        }
      },
      NETWORK_TIMEOUT_MS,
    );
  });
});
