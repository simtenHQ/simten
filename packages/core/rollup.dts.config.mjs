// Rollup config that bundles @simten/core's emitted .d.ts tree into a single
// self-contained .d.ts. Used by the Monaco editor at /circuit to give users
// autocomplete/type-checking on circuit(), bit, bus, reg, mem, and every
// stdlib component — without maintaining a hand-rolled mirror.
//
// Input:  dist/index.d.ts (produced by `tsc -b`)
// Output: dist/bundle.d.ts (consumed by apps/web via `@simten/core/bundle?raw`)

import { dts } from 'rollup-plugin-dts';

export default {
  input: 'dist/index.d.ts',
  output: {
    file: 'dist/bundle.d.ts',
    format: 'es',
  },
  plugins: [dts()],
};
