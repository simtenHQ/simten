// Failing testbench: a wrong reference (claims carry is always 0) so the gate
// reports testbench_passed:false with a shrunk counterexample.
import { simulate } from '@simten/core/sim';
import { verify, declareOracle } from '@simten/core/verify';
import * as fc from 'fast-check';
import { HalfAdder } from './half-adder.circuit.js';

declareOracle({ tier: 'B', type: 'wrong: carry always 0', independence_basis: 'intentionally buggy reference for the test' });
verify.check('carry always 0 (wrong)', fc.property(fc.boolean(), fc.boolean(), (a, b) => {
  const s = simulate(HalfAdder);
  try { s.set({ a: a ? 1 : 0, b: b ? 1 : 0 }); return s.get('carry') === 0; }
  finally { s.dispose(); }
}));
verify.run();
