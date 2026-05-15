import { encodeAuto, encodePrimitive } from '../encoding/encoder';
import { ValidationError } from '../utils/errors';
import { assertProgramId } from '../utils/validation';

import { ProgramCallBuilder } from './ProgramCallBuilder';

import type { AleoPrimitiveType, AleoValue } from '../types/aleo';
import type {
  PreparedProgramCall,
  ProgramAbi,
  ProgramCallRequest,
  ProgramFunctionAbi,
} from '../types/program';

/**
 * Translates user-facing call requests into encoded, broadcast-ready payloads.
 *
 * Stateless — safe to share across calls.
 */
export class ProgramService {
  constructor(private readonly knownAbis: Map<string, ProgramAbi> = new Map()) {}

  registerAbi(abi: ProgramAbi): void {
    this.knownAbis.set(abi.id, abi);
  }

  hasAbi(id: string): boolean {
    return this.knownAbis.has(id);
  }

  /**
   * Prepare a {@link ProgramCallRequest} for broadcast.
   *
   * If a matching ABI was previously registered, inputs are encoded against
   * the declared types and the input count is validated. Otherwise the
   * service falls back to {@link encodeAuto}.
   */
  prepare(request: ProgramCallRequest): PreparedProgramCall {
    assertProgramId(request.programId);
    if (!request.functionName) {
      throw new ValidationError('functionName is required.');
    }

    const abi = this.knownAbis.get(request.programId);
    const fnAbi = abi?.functions.find((f) => f.name === request.functionName);

    const builder = ProgramCallBuilder.for(request.programId, request.functionName);
    if (fnAbi) {
      builder.withAbi(fnAbi);
    }
    if (request.fee !== undefined) {
      builder.fee(request.fee);
    }
    if (request.feeRecord !== undefined) {
      builder.feeRecord(request.feeRecord);
    }

    const encoded = this.encodeInputs(request.inputs, fnAbi);
    for (const value of encoded) {
      builder.addInput(value);
    }
    return builder.build();
  }

  private encodeInputs(
    inputs: readonly unknown[],
    fnAbi: ProgramFunctionAbi | undefined,
  ): readonly AleoValue[] {
    if (!fnAbi) {
      return inputs.map((v) => encodeAuto(v));
    }
    if (inputs.length !== fnAbi.inputs.length) {
      throw new ValidationError(
        `Function ${fnAbi.name} expects ${fnAbi.inputs.length} inputs, received ${inputs.length}.`,
      );
    }
    return inputs.map((value, i) => {
      const declared = fnAbi.inputs[i]?.type;
      if (!declared) {
        return encodeAuto(value);
      }
      return encodePrimitive(value, declared as AleoPrimitiveType);
    });
  }
}
