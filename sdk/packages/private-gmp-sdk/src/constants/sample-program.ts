/**
 * Hardcoded identifiers and signature for the `sample_program.aleo` contract
 * exercised end-to-end by `AleoWalletProvider#callSampleMain`.
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
 */

export const SAMPLE_PROGRAM_NAME = 'sample_program.aleo';
export const SAMPLE_MAIN_FUNCTION = 'main';

/** Inclusive max for an Aleo u32 literal (2^32 - 1). */
export const U32_MAX = 0xffff_ffff;

/**
 * Signature for `sample_program.aleo/main`. The `visibility` field is
 * documentation-only — Aleo enforces it via the contract itself; the SDK
 * uses this shape to validate input count and type before broadcast.
 */
export const SAMPLE_MAIN_SIGNATURE = {
  inputs: [
    { name: 'r0', type: 'u32', visibility: 'public' },
    { name: 'r1', type: 'u32', visibility: 'private' },
  ],
  output: { type: 'u32', visibility: 'private' },
} as const;
