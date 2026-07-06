// Contract violation: real checks, but no oracle declared. The gate must refuse
// to emit a passed result (phase:'contract') — UNLESS an oracle is injected via
// SIMTEN_VERIFY_ORACLE (the verify_circuit tool's path), which then passes.
import { simulate } from '@simten/core/sim';
import { verify } from '@simten/core/verify';
import { HalfAdder } from './half-adder.circuit.js';

verify.exhaustive('truth table', [2, 2], (a, b) => {
  const s = simulate(HalfAdder);
  try {
    s.set({ a, b });
    return s.get('sum') === (a ^ b) && s.get('carry') === (a & b);
  } finally {
    s.dispose();
  }
});
verify.run();
