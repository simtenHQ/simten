// Passing testbench: HalfAdder against a plain-JS reference, exhaustive.
import { simulate } from '@simten/core/sim';
import { verify, declareOracle, describe } from '@simten/core/verify';
import { HalfAdder } from './half-adder.circuit.js';

describe('HalfAdder');
declareOracle({
  tier: 'B',
  type: 'sum=a^b, carry=a&b',
  independence_basis: 'plain-JS reference, decorrelated from gates',
});
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
