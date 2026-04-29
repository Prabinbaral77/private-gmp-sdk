import { describe, expect, it } from 'vitest';

import { ProgramCallBuilder, ProgramService } from '@/program';
import { ValidationError } from '@/utils/errors';

import { CREDITS_ABI, SAMPLE_RECIPIENT } from '../fixtures/sample-data';

describe('ProgramCallBuilder', () => {
  it('builds a basic call with typed inputs', () => {
    const call = ProgramCallBuilder.for('credits.aleo', 'transfer_public')
      .addInput(SAMPLE_RECIPIENT, 'address')
      .addInput(1_000n, 'u64')
      .fee(500_000n)
      .build();

    expect(call.programId).toBe('credits.aleo');
    expect(call.functionName).toBe('transfer_public');
    expect(call.encodedInputs).toEqual([SAMPLE_RECIPIENT, '1000u64']);
    expect(call.fee).toBe(500_000n);
  });

  it('respects ABI arity', () => {
    const builder = ProgramCallBuilder.for('credits.aleo', 'transfer_public')
      .withAbi(CREDITS_ABI.functions[0]!)
      .addInput(SAMPLE_RECIPIENT, 'address');
    expect(() => builder.build()).toThrow(ValidationError);
  });

  it('rejects missing program/function', () => {
    expect(() => new ProgramCallBuilder().build()).toThrow(ValidationError);
  });

  it('rejects negative fee', () => {
    expect(() =>
      ProgramCallBuilder.for('credits.aleo', 'transfer_public').fee(-1n),
    ).toThrow(ValidationError);
  });
});

describe('ProgramService', () => {
  it('encodes against a registered ABI', () => {
    const svc = new ProgramService();
    svc.registerAbi(CREDITS_ABI);

    const call = svc.prepare({
      programId: 'credits.aleo',
      functionName: 'transfer_public',
      inputs: [SAMPLE_RECIPIENT, 1_000n],
    });

    expect(call.encodedInputs).toEqual([SAMPLE_RECIPIENT, '1000u64']);
  });

  it('falls back to encodeAuto when no ABI is known', () => {
    const svc = new ProgramService();
    const call = svc.prepare({
      programId: 'credits.aleo',
      functionName: 'transfer_public',
      inputs: [SAMPLE_RECIPIENT, 1_000],
    });
    expect(call.encodedInputs).toEqual([SAMPLE_RECIPIENT, '1000u64']);
  });

  it('rejects mismatched arity against ABI', () => {
    const svc = new ProgramService();
    svc.registerAbi(CREDITS_ABI);
    expect(() =>
      svc.prepare({
        programId: 'credits.aleo',
        functionName: 'transfer_public',
        inputs: [SAMPLE_RECIPIENT],
      }),
    ).toThrow(ValidationError);
  });
});
