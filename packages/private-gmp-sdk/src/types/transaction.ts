import type { AleoAddress } from './aleo';
import type { FunctionName, ProgramId } from './program';

export type TransactionId = `at1${string}`;

export type TransactionStatus = 'pending' | 'accepted' | 'rejected' | 'finalized' | 'failed';

export type TransactionReceipt = {
  readonly id: TransactionId;
  readonly status: TransactionStatus;
  readonly programId: ProgramId;
  readonly functionName: FunctionName;
  readonly caller: AleoAddress;
  readonly fee: bigint;
  readonly blockHeight?: number;
  readonly timestamp?: number;
  readonly errorMessage?: string;
};

export type TransactionBroadcastResult = {
  readonly id: TransactionId;
  readonly accepted: boolean;
};
