// Forgot verify.run(): the beforeExit safety net must emit a phase:'contract'
// error instead of exiting 0 with no JSON block.
import { simulate } from '@simten/core/sim';
import { verify, declareOracle } from '@simten/core/verify';
import { HalfAdder } from './half-adder.circuit.js';

declareOracle({ tier: 'B', type: 'ref', independence_basis: 'ref' });
verify.exhaustive('truth table', [2, 2], (a, b) => {
  const s = simulate(HalfAdder);
  try { s.set({ a, b }); return s.get('sum') === (a ^ b) && s.get('carry') === (a & b); }
  finally { s.dispose(); }
});
// NOTE: verify.run() intentionally omitted.
