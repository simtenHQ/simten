// Flagship: an npm package used as the verification oracle. This is the whole
// reason verify runs on the host — `@noble/hashes` resolves from node_modules,
// no esbuild/stripImports. Tier A: the expected bytes come from an external
// crypto library, independent of the circuit.

import { sha256 } from '@noble/hashes/sha2.js';
import { simulate } from '@simten/core/sim';
import { declareOracle, verify } from '@simten/core/verify';
import { HashRom } from './flagship-rom.circuit.js';

const expected = sha256(new Uint8Array(0)); // independent reference vector

declareOracle({
  tier: 'A',
  type: '@noble/hashes sha256("") reference vector',
  independence_basis: 'expected bytes come from an external npm crypto library, not this circuit',
});
verify.exhaustive('ROM holds sha256("")[0..3]', [4], (addr) => {
  const s = simulate(HashRom);
  try {
    s.set({ addr });
    s.tick();
    return s.get('data') === expected[addr];
  } finally {
    s.dispose();
  }
});
verify.run();
