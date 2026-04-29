// Ambient types for optional peer deps that ship without their own types.
// Kept narrow on purpose — only the surface this SDK touches.

declare module 'bs58' {
  const bs58: {
    encode(data: Uint8Array): string;
    decode(s: string): Uint8Array;
  };
  export default bs58;
}
