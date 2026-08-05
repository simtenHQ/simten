import { describe, expect, it } from 'vitest';
import { executeCircuitCode } from '../../circuit/execute.js';
import { elaborate } from '../index.js';
import { assertFlatCircuitInvariants } from './_invariants.js';

describe('composite elaboration', () => {
  it('elaborates HalfAdder composite', () => {
    const code = `const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
        inputs.a.to(xor1.a, and1.a),
        inputs.b.to(xor1.b, and1.b),
        xor1.out.to(outputs.sum),
        and1.out.to(outputs.carry),
      ],
    })

    const Demo = circuit('Demo', {
      nodes: { sw_a: Switch, sw_b: Switch, dut: HalfAdder, led_sum: Led, led_carry: Led },
      connect: ({ nodes: { sw_a, sw_b, dut, led_sum, led_carry } }) => [
        sw_a.out.to(dut.a), sw_b.out.to(dut.b),
        dut.sum.to(led_sum.in), dut.carry.to(led_carry.in),
      ],
    })`;

    const result = executeCircuitCode(code);
    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);

    const flat = elaborate(result.circuit!, result.library);
    expect(flat.nodes.length).toBeGreaterThan(0);
    // #140 audit: structural net on every elaboration this test exercises.
    assertFlatCircuitInvariants(flat);
    console.log('flat nodes:', flat.nodes.length);
  });
});
