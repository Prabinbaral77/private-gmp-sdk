import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'encoding/index': 'src/encoding/index.ts',
    'types/index': 'src/types/index.ts',
    'derivation/index': 'src/derivation/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  external: [
    '@sodax/wallet-sdk',
    '@provablehq/sdk',
    '@solana/web3.js',
    'bs58',
    'ethers',
    'tweetnacl',
  ],
});
