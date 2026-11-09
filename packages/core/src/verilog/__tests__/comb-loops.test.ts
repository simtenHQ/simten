/**
 * The exporter refuses combinational loops (#574, ADR 0002). The simulator
 * settles a latch built from gates; synthesis doesn't, so the export throws
 * and names the nodes on the loop.
 */

import { describe, expect, it } from 'vitest';
import { bit, circuit } from '../../circuit/index.js';
import { simulate } from '../../simulator/simulate.js';
import { DFlipFlop, Nand, Nor, Not } from '../../std/index.js';
import { CombinationalLoopError, findCombinationalLoop } from '../comb-loops.js';
import { checkSynthesizable, exportVerilog } from '../exporter.js';

const Ring = circuit('Ring', {
  inputs: { en: bit },
  outputs: { o: bit },
  nodes: { n: Nand },
  connect: ({ inputs, outputs, nodes: { n } }) => [inputs.en.to(n.a), n.out.to(n.b, outputs.o)],
});

const SRLatch = circuit('SRLatch', {
  inputs: { s: bit, r: bit },
  outputs: { q: bit },
  nodes: { top: Nor, bottom: Nor },
  connect: ({ inputs, outputs, nodes: { top, bottom } }) => [
    inputs.r.to(top.a),
    inputs.s.to(bottom.b),
    top.out.to(bottom.a, outputs.q),
    bottom.out.to(top.b),
  ],
});

function loopOf(run: () => unknown): CombinationalLoopError {
  try {
    run();
  } catch (e) {
    if (e instanceof CombinationalLoopError) return e;
    throw e;
  }
  throw new Error('expected a CombinationalLoopError');
}

describe('exporting a combinational loop', () => {
  it('throws for a gate that feeds itself', () => {
    const e = loopOf(() => exportVerilog(Ring));
    expect(e.nodes).toEqual(['n']);
    expect(e.message).toContain('Combinational loop: n -> n.');
    expect(e.message).toContain('Register or DFlipFlop');
  });

  it('throws for an SR latch of two gates, naming both', () => {
    const e = loopOf(() => exportVerilog(SRLatch));
    expect([...e.nodes].sort()).toEqual(['bottom', 'top']);
  });

  it('still simulates: the latch holds what was set', () => {
    const sim = simulate(SRLatch);
    const q = (s: number, r: number) => {
      sim.set({ s, r });
      return sim.get('q');
    };
    expect([q(1, 0), q(0, 0), q(0, 1), q(0, 0)]).toEqual([1, 1, 0, 0]);
  });

  it('is reported by checkSynthesizable', () => {
    const v = checkSynthesizable(SRLatch);
    expect(v.valid).toBe(false);
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0]).toMatch(/^Combinational loop: /);
  });

  it('exports a loop broken by a DFlipFlop', () => {
    const Toggle = circuit('Toggle', {
      outputs: { q: bit },
      nodes: { ff: DFlipFlop(), inv: Not },
      connect: ({ outputs, nodes: { ff, inv } }) => [ff.q.to(inv.in, outputs.q), inv.out.to(ff.d)],
    });
    expect(exportVerilog(Toggle).verilog).toContain('always @(posedge clk)');
  });

  it("exports a node that reads one of its own outputs through a port that output doesn't depend on", () => {
    // Node-level this is a cycle (p -> p); port-level it is a -> x -> b -> y.
    const Pass = circuit('Pass', {
      inputs: { a: bit, b: bit },
      outputs: { x: bit, y: bit },
      eval: ({ a, b }) => ({ x: a, y: b }),
    });
    const Top = circuit('PassTop', {
      inputs: { a: bit },
      outputs: { y: bit },
      nodes: { p: Pass },
      connect: ({ inputs, outputs, nodes: { p } }) => [
        inputs.a.to(p.a),
        p.x.to(p.b),
        p.y.to(outputs.y),
      ],
    });
    expect(exportVerilog(Top).unsupported).toBeUndefined();
  });
});

describe('findCombinationalLoop', () => {
  const find = (...nodes: [string, string[]][]) =>
    findCombinationalLoop(nodes.map(([nodeId, lines]) => ({ nodeId, lines })));

  it('follows nets through assigns across nodes', () => {
    // The loop is reported from wherever the search meets it, so compare as a set.
    expect(find(['a', ['assign x = y & en;']], ['b', ['assign y = ~x;']])?.sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('ignores sized literals and system functions', () => {
    expect(find(['a', ["assign x = $signed(y) + 8'hff;"]], ['b', ['assign y = z;']])).toBe(
      undefined,
    );
  });

  it('treats a clocked block as breaking the loop', () => {
    expect(
      find(
        ['r', ['always @(posedge clk) begin', '  if (!rst_n) q <= 0;', '  else q <= d;', 'end']],
        ['g', ['assign d = ~q;']],
      ),
    ).toBe(undefined);
  });

  it('finds a loop through an always @(*) block', () => {
    const loop = find(
      [
        'm',
        [
          'always @(*) begin',
          '  case (s)',
          "    1'b0: t = a;",
          '    default: t = 0;',
          '  endcase',
          'end',
          'assign y = t;',
        ],
      ],
      ['g', ['assign a = y;']],
    );
    expect(loop?.sort()).toEqual(['g', 'm']);
  });

  it('does not count a net an always @(*) block writes then reads as a loop', () => {
    expect(
      find([
        'c',
        ['always @(*) begin', '  t = 0;', '  if (op) t = 1;', '  u = t;', 'end', 'assign y = u;'],
      ]),
    ).toBe(undefined);
  });
});
