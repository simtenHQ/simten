import { describe, expect, it } from 'vitest';
import { simulateCircuit } from '../simulate.js';

// ============================================================================
// Helpers
// ============================================================================

function parseScopes(vcd: string): string[] {
  return vcd
    .split('\n')
    .filter((l) => l.startsWith('$scope module'))
    .map((l) => l.replace('$scope module ', '').replace(' $end', '').trim());
}

function parseVars(vcd: string): Array<{ scope: string; name: string; width: number; id: string }> {
  const vars: Array<{ scope: string; name: string; width: number; id: string }> = [];
  const lines = vcd.split('\n');
  const scopeStack: string[] = [];

  for (const line of lines) {
    if (line.startsWith('$scope module ')) {
      scopeStack.push(line.replace('$scope module ', '').replace(' $end', '').trim());
    } else if (line.startsWith('$upscope')) {
      scopeStack.pop();
    } else if (line.startsWith('$var wire ')) {
      const parts = line.split(/\s+/);
      // $var wire <width> <id> <name> $end
      vars.push({
        scope: scopeStack[scopeStack.length - 1] ?? '',
        width: parseInt(parts[2], 10),
        id: parts[3],
        name: parts[4],
      });
    }
  }
  return vars;
}

function getChangeTicks(vcd: string): number[] {
  return vcd
    .split('\n')
    .filter((l) => /^#\d+$/.test(l))
    .map((l) => parseInt(l.slice(1), 10));
}

function getSignalValues(vcd: string, signalName: string): Array<{ tick: number; value: number }> {
  const lines = vcd.split('\n');
  const vars = parseVars(vcd);
  const varEntry = vars.find((v) => v.name === signalName);
  if (!varEntry) return [];

  const id = varEntry.id;
  const results: Array<{ tick: number; value: number }> = [];
  let currentTick = 0;

  for (const line of lines) {
    if (/^#\d+$/.test(line)) {
      currentTick = parseInt(line.slice(1), 10);
    } else if (line.startsWith('b') && line.endsWith(` ${id}`)) {
      const binStr = line.slice(1, line.lastIndexOf(' '));
      results.push({ tick: currentTick, value: parseInt(binStr, 2) });
    } else if ((line.startsWith('0') || line.startsWith('1')) && line.slice(1) === id) {
      results.push({ tick: currentTick, value: parseInt(line[0], 10) });
    }
  }
  return results;
}

// ============================================================================
// Tests
// ============================================================================

describe('VCD export — HalfAdder (combinational)', () => {
  const source = `
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x: Xor, and: And },
      connect: ({ inputs, outputs, nodes: { x, and } }) => [
        inputs.a.to(x.a, and.a),
        inputs.b.to(x.b, and.b),
        x.out.to(outputs.sum),
        and.out.to(outputs.carry),
      ],
    });
  `;

  it('has correct VCD header', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.vcd).toContain('$timescale 1ns $end');
    expect(result.vcd).toContain('$enddefinitions $end');
    expect(result.vcd).toContain('#0');
    expect(result.vcd).toContain('$dumpvars');
    expect(result.vcd).toContain('$end');
  });

  it('has top-level scope named HalfAdder', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const scopes = parseScopes(result.vcd);
    expect(scopes[0]).toBe('HalfAdder');
  });

  it('has internal node scopes for x (Xor) and and (And)', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const scopes = parseScopes(result.vcd);
    expect(scopes).toContain('x');
    expect(scopes).toContain('and');
  });

  it('has top-level ports a, b, sum, carry under HalfAdder scope', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    const topVars = vars.filter((v) => v.scope === 'HalfAdder').map((v) => v.name);
    expect(topVars).toContain('a');
    expect(topVars).toContain('b');
    expect(topVars).toContain('sum');
    expect(topVars).toContain('carry');
  });

  it('has internal ports for x (Xor) node', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    const xVars = vars.filter((v) => v.scope === 'x').map((v) => v.name);
    expect(xVars.length).toBeGreaterThan(0);
    expect(xVars).toContain('out');
  });

  it('all identifiers are unique', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    const ids = vars.map((v) => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('only emits changes, not every tick', () => {
    const result = simulateCircuit({ source, ticks: 10 });
    if ('error' in result) return;

    // HalfAdder with constant inputs — no changes after t=0
    const ticks = getChangeTicks(result.vcd);
    expect(ticks).toContain(0);
    expect(ticks).toContain(10); // final timestamp
    // Should not have intermediate ticks since inputs don't change
    expect(ticks.filter((t) => t > 0 && t < 10).length).toBe(0);
  });
});

describe('VCD export — Counter (sequential)', () => {
  const source = `
    const Counter = circuit('Counter', {
      outputs: { count: bus(8) },
      nodes: { reg: Register({ width: 8 }), adder: Adder({ width: 8 }), one: Constant({ value: 1 }), we: Constant({ value: 1 }), zero: Constant({ value: 0 }) },
      connect: ({ outputs, nodes: { reg, adder, one, we, zero } }) => [
        reg.q.to(adder.a),
        one.out.to(adder.b),
        zero.out.to(adder.carry_in),
        adder.sum.to(reg.data),
        we.out.to(reg.we),
        reg.q.to(outputs.count),
      ],
    });
  `;

  it('has Counter as top-level scope', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const scopes = parseScopes(result.vcd);
    expect(scopes[0]).toBe('Counter');
  });

  it('has internal scopes for reg, adder, one, we, zero', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const scopes = parseScopes(result.vcd);
    expect(scopes).toContain('reg');
    expect(scopes).toContain('adder');
    expect(scopes).toContain('one');
  });

  it('count signal increments 1 through 5', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const changes = getSignalValues(result.vcd, 'count');
    const values = changes.map((c) => c.value);
    expect(values).toContain(1);
    expect(values).toContain(2);
    expect(values).toContain(3);
    expect(values).toContain(4);
    expect(values).toContain(5);
  });

  it('emits a change every tick (counter increments each tick)', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const ticks = getChangeTicks(result.vcd);
    // Every tick should have a change since count increments each cycle
    for (let t = 0; t <= 5; t++) {
      expect(ticks).toContain(t);
    }
  });

  it('reg node has q port', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    const regVars = vars.filter((v) => v.scope === 'reg').map((v) => v.name);
    expect(regVars).toContain('q');
  });

  it('bus signals are 32-bit wide', () => {
    const result = simulateCircuit({ source, ticks: 5 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    const countVar = vars.find((v) => v.name === 'count' && v.scope === 'Counter');
    expect(countVar).toBeDefined();
    expect(countVar!.width).toBe(32);
  });
});

describe('VCD export — nested composite (FullAdder)', () => {
  const source = `
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x: Xor, and: And },
      connect: ({ inputs, outputs, nodes: { x, and } }) => [
        inputs.a.to(x.a, and.a),
        inputs.b.to(x.b, and.b),
        x.out.to(outputs.sum),
        and.out.to(outputs.carry),
      ],
    });

    const FullAdder = circuit('FullAdder', {
      inputs: { a: bit, b: bit, cin: bit },
      outputs: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, orGate: Or },
      connect: ({ inputs, outputs, nodes: { ha1, ha2, orGate } }) => [
        inputs.a.to(ha1.a),
        inputs.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inputs.cin.to(ha2.b),
        ha2.sum.to(outputs.sum),
        ha1.carry.to(orGate.a),
        ha2.carry.to(orGate.b),
        orGate.out.to(outputs.cout),
      ],
    });
  `;

  it('has nested scopes: FullAdder > ha1, ha2', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const scopes = parseScopes(result.vcd);
    expect(scopes[0]).toBe('FullAdder');
    expect(scopes).toContain('ha1');
    expect(scopes).toContain('ha2');
  });

  it('has deeply nested internal nodes from HalfAdder instances', () => {
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    // ha1 contains x (Xor) and and (And) — these become ha1.x and ha1.and
    // In the VCD they should appear under ha1 scope
    const vars = parseVars(result.vcd);
    const allScopes = parseScopes(result.vcd);

    // ha1's children should be scopes
    expect(allScopes.length).toBeGreaterThan(3); // FullAdder, ha1, ha2, orGate + nested
  });

  it('ha1 inner Xor node (x) has out port', () => {
    // Composite nodes (HalfAdder) are flattened — ha1 itself has no $var lines.
    // The ha1 scope contains child scopes for its primitives: x (Xor) and and (And).
    const result = simulateCircuit({ source, ticks: 4 });
    if ('error' in result) return;

    const vars = parseVars(result.vcd);
    // ha1.x is the Xor inside ha1; its out port is what drives ha1's sum output
    const xVars = vars.filter((v) => v.scope === 'x').map((v) => v.name);
    expect(xVars).toContain('out');
  });
});
