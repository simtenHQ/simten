/**
 * Imported nodes are named after the RTL signals they drive.
 *
 * Drilling into an imported design used to land on `add_45`, `mux_92`, `or_32`
 * — names built from the operator and the source line, which say what a node is
 * and nothing about what it means. The netlist already carries better ones:
 * yosys records each net's source name in `netnames` with `hide_name: 0`, and
 * `serv_alu` has 24 of those against 17 it invented, including every label in
 * SERV's own block diagram.
 *
 * The pass is only useful if it stays honest, so this guards where it must
 * *not* fire as carefully as where it must:
 *
 *  1. A cell driving one whole named net takes that name.
 *  2. A cell driving several whole named nets takes the one on bit 0 —
 *     `{add_cy, result_add} = x + y` is one adder over a value and its carry.
 *  3. A cell driving only part of a named net keeps its operator name. Two
 *     cells each producing half of `split` may not both claim to be `split`.
 *  4. An instance the author named keeps that name. `named_leaf` is already
 *     better than any net it happens to drive.
 *
 * Node ids stay unique regardless — two cells that want the same signal name
 * can't collide, or the emitted source wouldn't compile.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8'),
  ) as YosysNetlist;

/** node id → component, for the top module. */
function nodesOf(netlist: YosysNetlist, top: string): Map<string, string> {
  const { top: circuit } = importNetlist(netlist, top);
  return new Map(circuit.nodes.map((n) => [n.id, n.componentRef]));
}

describe('nodes are named after the RTL signals they drive', () => {
  const nodes = nodesOf(fix('net-names.json'), 'net_names');

  it('names a cell after the whole net it drives', () => {
    // `assign masked = x & y` — one $and covering every bit of `masked`.
    expect(nodes.get('masked')).toBe('BusAnd');
    expect([...nodes.keys()]).not.toContain('and_28');
  });

  it('takes the name on bit 0 when one cell drives a value and its carry', () => {
    // `assign {add_cy, result_add} = x + y`, which also aliases `o_sum`. The
    // adder is named for the low bits — the sum — not for the carry riding
    // above them.
    expect(nodes.get('o_sum')).toBe('Adder');
    expect([...nodes.keys()]).not.toContain('add_cy');
  });

  it('leaves a cell driving only part of a net alone', () => {
    // `split[1:0]` and `split[3:2]` come from different cells, so neither one
    // is `split`. Both keep their operator-and-line names.
    expect(nodes.get('or_32')).toBe('BusOr');
    expect(nodes.get('xor_33')).toBe('BusXor');
    expect([...nodes.keys()]).not.toContain('split');
    expect([...nodes.keys()]).not.toContain('o_split');
  });

  it('keeps the name the author gave an instance', () => {
    expect(nodes.get('named_leaf')).toBe('leaf');
  });

  it('keeps every node id unique', () => {
    const { top, library } = importNetlist(fix('net-names.json'), 'net_names');
    for (const circuit of [top, ...library.values()]) {
      const ids = circuit.nodes.map((n) => n.id);
      expect(new Set(ids).size, `duplicate node id in ${circuit.name}`).toBe(ids.length);
    }
  });

  it('does nothing to a netlist without source-level net names', () => {
    // Hand-built netlists (and `netnames`-free fixtures) must still import.
    const netlist = fix('net-names.json');
    for (const mod of Object.values(netlist.modules) as Array<{ netnames?: unknown }>) {
      mod.netnames = undefined;
    }
    const bare = nodesOf(netlist, 'net_names');
    expect(bare.get('and_28')).toBe('BusAnd');
    expect(bare.get('named_leaf')).toBe('leaf');
  });
});
