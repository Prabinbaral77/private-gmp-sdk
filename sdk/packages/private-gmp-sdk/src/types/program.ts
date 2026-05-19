import type { AleoValue } from './aleo';

/** Identifier for an on-chain program, e.g. `credits.aleo`. */
export type ProgramId = `${string}.aleo`;

/** Name of a transition / function within a program. */
export type FunctionName = string;

export type ProgramFunctionInput = {
  readonly name: string;
  readonly type: string;
  readonly visibility: 'public' | 'private' | 'constant';
};

export type ProgramFunctionOutput = {
  readonly type: string;
  readonly visibility: 'public' | 'private';
};

export type ProgramFunctionAbi = {
  readonly name: FunctionName;
  readonly inputs: readonly ProgramFunctionInput[];
  readonly outputs: readonly ProgramFunctionOutput[];
};

export type ProgramAbi = {
  readonly id: ProgramId;
  readonly functions: readonly ProgramFunctionAbi[];
};

/**
 * The user-supplied description of a contract call.
 *
 * `inputs` may be plain JS values (numbers, bigints, booleans, strings, objects)
 * — they will be encoded into Aleo wire format by the {@link Encoder}.
 */
export type ProgramCallRequest = {
  readonly programId: ProgramId;
  readonly functionName: FunctionName;
  readonly inputs: readonly unknown[];
  readonly fee?: bigint;
  readonly feeRecord?: string;
};

/**
 * A normalised, ready-to-broadcast representation of {@link ProgramCallRequest}.
 *
 * `encodedInputs` are guaranteed to be valid Aleo string literals.
 */
export type PreparedProgramCall = {
  readonly programId: ProgramId;
  readonly functionName: FunctionName;
  readonly encodedInputs: readonly AleoValue[];
  readonly fee: bigint;
  readonly feeRecord?: string;
};
