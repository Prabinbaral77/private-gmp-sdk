/**
 * Primitive Aleo value types as serialised strings.
 *
 * Aleo programs operate on typed values (`u8`, `u64`, `field`, `address`, ...).
 * In transit they are represented as strings with the type suffix, e.g.
 * `"42u64"`, `"1234567field"`, `"aleo1abc...xyz"`.
 *
 * The branded types below give us compile-time safety while keeping the
 * runtime representation a plain string.
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type AleoAddress = Brand<string, 'AleoAddress'>;
export type AleoField = Brand<string, 'AleoField'>;
export type AleoScalar = Brand<string, 'AleoScalar'>;
export type AleoGroup = Brand<string, 'AleoGroup'>;
export type AleoBoolean = Brand<'true' | 'false', 'AleoBoolean'>;
export type AleoSignature = Brand<string, 'AleoSignature'>;

export type AleoUnsignedInt =
  | Brand<string, 'AleoU8'>
  | Brand<string, 'AleoU16'>
  | Brand<string, 'AleoU32'>
  | Brand<string, 'AleoU64'>
  | Brand<string, 'AleoU128'>;

export type AleoSignedInt =
  | Brand<string, 'AleoI8'>
  | Brand<string, 'AleoI16'>
  | Brand<string, 'AleoI32'>
  | Brand<string, 'AleoI64'>
  | Brand<string, 'AleoI128'>;

export type AleoIntegerType =
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'u128'
  | 'i8'
  | 'i16'
  | 'i32'
  | 'i64'
  | 'i128';

export type AleoPrimitiveType =
  | AleoIntegerType
  | 'field'
  | 'scalar'
  | 'group'
  | 'address'
  | 'bool'
  | 'signature';

export type AleoPrimitive =
  | AleoAddress
  | AleoField
  | AleoScalar
  | AleoGroup
  | AleoBoolean
  | AleoSignature
  | AleoUnsignedInt
  | AleoSignedInt;

/** A struct-like value passed to a program function. */
export type AleoStruct = { readonly [key: string]: AleoValue };

/** Anything an Aleo program function can accept as an input. */
export type AleoValue = AleoPrimitive | AleoStruct | readonly AleoValue[];

/** Microcredits — the base unit of Aleo's native credits token (1 credit = 1_000_000 microcredits). */
export type Microcredits = bigint;
