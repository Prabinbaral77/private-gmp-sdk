import {
  SAMPLE_MAIN_FUNCTION,
  SAMPLE_PROGRAM_NAME,
  U32_MAX,
} from '@/constants/sample-program';
import type {
  AleoExecuteOptions,
  AleoExecutionResult,
  AleoTransactionReceipt,
  AleoWaitForReceiptOptions,
} from '@/types/wallet';
import { ValidationError } from '@/utils/errors';
import type { AleoWalletProvider } from '@/wallet/aleo-wallet-provider';

/** Per-call options for any `SampleProgram` transition — everything except program/function/inputs. */
export type SampleProgramCallOptions = Omit<
  AleoExecuteOptions,
  'programName' | 'functionName' | 'inputs'
>;

/**
 * Typed wrapper around `sample_program.aleo`:
 *
 * ```leo
 * program sample_program.aleo;
 *
 * function main:
 *     input r0 as u32.public;
 *     input r1 as u32.private;
 *     add r0 r1 into r2;
 *     output r2 as u32.private;
 * ```
 *
 * Encodes the program name, function name, and input signature so callers
 * cannot misroute the call or pass a wrong-typed input. Each method
 * delegates to a generic `AleoWalletProvider#execute` after validation.
 */
export class SampleProgram {
  constructor(private readonly wallet: AleoWalletProvider) {}

  /** Call `main(r0: u32.public, r1: u32.private)`. */
  main(r0: number, r1: number, options: SampleProgramCallOptions = {}): Promise<AleoExecutionResult> {
    return this.wallet.execute({ ...options, ...buildMainCall(r0, r1) });
  }

  /** Call `main(...)` and block until the network confirms the transaction. */
  mainAndWait(
    r0: number,
    r1: number,
    options: SampleProgramCallOptions = {},
    receiptOptions: AleoWaitForReceiptOptions = {},
  ): Promise<{ result: AleoExecutionResult; receipt: AleoTransactionReceipt }> {
    return this.wallet.executeAndWait({ ...options, ...buildMainCall(r0, r1) }, receiptOptions);
  }
}

function buildMainCall(
  r0: number,
  r1: number,
): Pick<AleoExecuteOptions, 'programName' | 'functionName' | 'inputs'> {
  assertU32(r0, 'r0');
  assertU32(r1, 'r1');
  return {
    programName: SAMPLE_PROGRAM_NAME,
    functionName: SAMPLE_MAIN_FUNCTION,
    inputs: [`${r0}u32`, `${r1}u32`],
  };
}

function assertU32(value: number, paramName: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ValidationError(`${paramName} must be an integer u32, received ${String(value)}.`);
  }
  if (value < 0 || value > U32_MAX) {
    throw new ValidationError(`${paramName} must be in [0, ${U32_MAX}], received ${value}.`);
  }
}
