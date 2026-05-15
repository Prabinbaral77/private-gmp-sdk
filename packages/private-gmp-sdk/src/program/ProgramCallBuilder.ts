import { encodeAuto, encodePrimitive, encodeStruct } from '../encoding/encoder';
import { ValidationError } from '../utils/errors';
import { assertProgramId } from '../utils/validation';

import type { AleoPrimitiveType, AleoValue } from '../types/aleo';
import type {
  FunctionName,
  PreparedProgramCall,
  ProgramId,
  ProgramFunctionAbi,
} from '../types/program';

const DEFAULT_FEE = 300_000n;

/**
 * Fluent builder for {@link PreparedProgramCall}.
 *
 * Two construction modes:
 *
 * 1. **ABI-driven** — pass a {@link ProgramFunctionAbi}. Each input is
 *    encoded against its declared Aleo type and arity is enforced.
 * 2. **Loose** — push raw inputs with {@link addInput}; the encoder uses
 *    {@link encodeAuto} which guesses based on JS type. Suitable for
 *    quick prototyping; prefer ABI-driven calls in production.
 */
export class ProgramCallBuilder {
  private programId?: ProgramId;
  private functionName?: FunctionName;
  private abi?: ProgramFunctionAbi;
  private readonly inputs: AleoValue[] = [];
  private feeAmount = DEFAULT_FEE;
  private feeRecordValue?: string;

  static for(programId: ProgramId, functionName: FunctionName): ProgramCallBuilder {
    return new ProgramCallBuilder().program(programId).function(functionName);
  }

  program(id: ProgramId): this {
    assertProgramId(id);
    this.programId = id;
    return this;
  }

  function(name: FunctionName): this {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('function name must be a non-empty string.');
    }
    this.functionName = name;
    return this;
  }

  withAbi(abi: ProgramFunctionAbi): this {
    this.abi = abi;
    this.functionName = abi.name;
    return this;
  }

  fee(amount: bigint): this {
    if (amount < 0n) {
      throw new ValidationError('fee must be non-negative.');
    }
    this.feeAmount = amount;
    return this;
  }

  feeRecord(record: string): this {
    this.feeRecordValue = record;
    return this;
  }

  addInput(value: unknown, type?: AleoPrimitiveType): this {
    this.inputs.push(type ? encodePrimitive(value, type) : encodeAuto(value));
    return this;
  }

  addStruct(value: Record<string, unknown>, schema: Record<string, AleoPrimitiveType>): this {
    this.inputs.push(encodeStruct(value, schema) as AleoValue);
    return this;
  }

  build(): PreparedProgramCall {
    if (!this.programId) {
      throw new ValidationError('programId is required (call .program()).');
    }
    if (!this.functionName) {
      throw new ValidationError('functionName is required (call .function() or .withAbi()).');
    }

    if (this.abi) {
      if (this.inputs.length !== this.abi.inputs.length) {
        throw new ValidationError(
          `Expected ${this.abi.inputs.length} inputs for ${this.abi.name}, got ${this.inputs.length}.`,
        );
      }
    }

    const prepared: PreparedProgramCall = {
      programId: this.programId,
      functionName: this.functionName,
      encodedInputs: [...this.inputs],
      fee: this.feeAmount,
      ...(this.feeRecordValue !== undefined && { feeRecord: this.feeRecordValue }),
    };
    return prepared;
  }
}
