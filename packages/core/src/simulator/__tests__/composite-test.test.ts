import { describe, it, expect } from 'vitest';
import { executeCircuitCode } from '../../circuit/execute.js';
import { elaborate } from '../index.js';

describe('composite elaboration', () => {
  it('elaborates HalfAdder composite', () => {
    const code = `const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ in: inp, out, xor1, and1 }) => [
        inp.a.to(xor1.a, and1.a),
        inp.b.to(xor1.b, and1.b),
        xor1.out.to(out.sum),
        and1.out.to(out.carry),
      ],
    })

    const Demo = circuit('Demo', {
      nodes: { sw_a: Switch, sw_b: Switch, dut: HalfAdder, led_sum: Led, led_carry: Led },
      connect: ({ sw_a, sw_b, dut, led_sum, led_carry }) => [
        sw_a.out.to(dut.a), sw_b.out.to(dut.b),
        dut.sum.to(led_sum.in), dut.carry.to(led_carry.in),
      ],
    })`;

    const result = executeCircuitCode(code);
    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);
    
    const flat = elaborate(result.circuit!, result.library);
    expect(flat.nodes.length).toBeGreaterThan(0);
    console.log('flat nodes:', flat.nodes.length);
  });
});
