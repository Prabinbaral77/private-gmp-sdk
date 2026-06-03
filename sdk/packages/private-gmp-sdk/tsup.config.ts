import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'derivation/index': 'src/derivation/index.ts',
    'scanner/index': 'src/scanner/index.ts',
    'fee-sponsor/index': 'src/fee-sponsor/index.ts',
    'wallet/index': 'src/wallet/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'mappings/index': 'src/mappings/index.ts',
    'consumer/index': 'src/consumer/index.ts',
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
  external: ['@provablehq/sdk', 'viem'],
});
