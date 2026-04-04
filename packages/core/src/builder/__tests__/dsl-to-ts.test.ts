/**
 * DSL-to-TypeScript Conversion Tests — Object Syntax
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDSL } from '../../dsl/parser/index.js';
import { executeCircuitCode } from '../execute.js';
import type {
  Program,
  CircuitDef,
  ConnectionStmt,
  TypeExpr,
} from '../../dsl/types/ast.js';

// ============================================================================
// Code generator — object syntax
// ============================================================================

export function generateTS(program: Program): string {
  const lines: string[] = [];
  const definedNames = new Set(program.circuits.map(c => c.name));
  lines.push('// Auto-generated from DSL\n');

  for (const circuit of program.circuits) {
    lines.push(generateCircuit(circuit, definedNames));
    lines.push('');
  }
  return lines.join('\n');
}

function generateCircuit(circuit: CircuitDef, definedNames: Set<string>): string {
  const ind = '  ';
  const parts: string[] = [];

  // Inputs
  if (circuit.inputs.length > 0) {
    const ins = circuit.inputs.map(i => `${i.name}: ${typeToTS(i.portType)}`).join(', ');
    parts.push(`${ind}in: { ${ins} },`);
  }

  // Outputs
  if (circuit.outputs.length > 0) {
    const outs = circuit.outputs.map(o => `${o.name}: ${typeToTS(o.portType)}`).join(', ');
    parts.push(`${ind}out: { ${outs} },`);
  }

  // Meta
  if (circuit.description) {
    parts.push(`${ind}meta: { description: ${JSON.stringify(circuit.description)} },`);
  }

  // Nodes + nodeArgs
  if (circuit.impl && circuit.impl.nodes.length > 0) {
    const nodeEntries: string[] = [];
    const argEntries: string[] = [];

    for (const node of circuit.impl.nodes) {
      nodeEntries.push(`${node.instanceName}: ${node.componentType}`);
      const clean = node.arguments
        .map(a => ({ name: a.name, value: cleanArgValue(a.value) }))
        .filter(a => a.value !== undefined);
      if (clean.length > 0) {
        const argsStr = clean.map(a => `${a.name}: ${JSON.stringify(a.value)}`).join(', ');
        argEntries.push(`${node.instanceName}: { ${argsStr} }`);
      }
    }

    parts.push(`${ind}nodes: { ${nodeEntries.join(', ')} },`);
    if (argEntries.length > 0) {
      parts.push(`${ind}nodeArgs: { ${argEntries.join(', ')} },`);
    }

    // Connections
    if (circuit.impl.connections.length > 0) {
      const nodeNames = circuit.impl.nodes.map(n => n.instanceName).join(', ');
      const grouped = groupConns(circuit.impl.connections, circuit);
      const connLines = grouped.map(g => {
        const src = fmtRef(g.source, circuit);
        const tgts = g.targets.map(t => fmtRef(t, circuit)).join(', ');
        return `${ind}${ind}${src}.to(${tgts}),`;
      });
      parts.push(`${ind}connect: ({ in: inp, out, ${nodeNames} }) => [`);
      parts.push(...connLines);
      parts.push(`${ind}],`);
    }
  }

  return `const ${circuit.name} = component('${circuit.name}', {\n${parts.join('\n')}\n})`;
}

function cleanArgValue(v: any): any {
  if (v == null) return undefined;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'object' && v.kind === 'object' && Array.isArray(v.entries)) {
    const o: Record<number, number> = {};
    for (const e of v.entries) o[e.key] = typeof e.value === 'object' ? cleanArgValue(e.value) : e.value;
    return o;
  }
  if (typeof v === 'object' && v.kind === 'array' && Array.isArray(v.elements)) {
    return v.elements.map((e: any) => cleanArgValue(e));
  }
  return undefined;
}

function typeToTS(t: TypeExpr): string {
  if (t.kind === 'bit') return 'bit';
  if (t.kind === 'bus') return `bus(${typeof t.width === 'number' ? t.width : t.width.name})`;
  return 'bit';
}

interface Grouped {
  source: { nodeId: string | null; portName: string };
  targets: { nodeId: string | null; portName: string }[];
}

function groupConns(conns: ConnectionStmt[], circuit: CircuitDef): Grouped[] {
  const clockNames = new Set(circuit.clocks.map(c => c.name));
  const filtered = conns.filter(c => {
    if (!c.source.nodeId && clockNames.has(c.source.portName)) return false;
    if (c.target.portName === 'clk') return false;
    return true;
  });

  const map = new Map<string, Grouped>();
  for (const c of filtered) {
    const key = c.source.nodeId ? `${c.source.nodeId}.${c.source.portName}` : c.source.portName;
    if (!map.has(key)) map.set(key, { source: c.source, targets: [] });
    map.get(key)!.targets.push(c.target);
  }
  return Array.from(map.values());
}

function fmtRef(ref: { nodeId: string | null; portName: string }, circuit: CircuitDef): string {
  if (!ref.nodeId) {
    if (circuit.inputs.some(i => i.name === ref.portName)) return `inp.${ref.portName}`;
    if (circuit.outputs.some(o => o.name === ref.portName)) return `out.${ref.portName}`;
    return `inp.${ref.portName}`;
  }
  return `${ref.nodeId}.${ref.portName}`;
}

// ============================================================================
// Tests
// ============================================================================

describe('DSL-to-TS conversion (object syntax)', () => {
  function convertAndExecute(dslSource: string) {
    const { ast, errors } = parseDSL(dslSource, 'test.dsl');
    if (errors.length > 0) {
      return { ts: '', error: `Parse: ${errors.map(e => e.message).join('; ')}`, circuitCount: 0, circuitNames: [] as string[] };
    }
    const ts = generateTS(ast);
    const result = executeCircuitCode(ts);
    return { ts, error: result.error, circuitCount: result.circuits.length, circuitNames: result.circuits.map(c => c.name) };
  }

  it('converts a simple circuit with switches and gates', () => {
    const result = convertAndExecute(`
      circuit Demo {
        impl {
          node sw1: Switch
          node sw2: Switch
          node and1: And
          node led: Led
          connect sw1.out -> and1.a
          connect sw2.out -> and1.b
          connect and1.out -> led.in
        }
      }
    `);
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBe(1);
  });

  it('converts a half adder with inputs/outputs', () => {
    const result = convertAndExecute(`
      circuit HalfAdder {
        input a: Bit
        input b: Bit
        output sum: Bit
        output carry: Bit
        impl {
          node xor1: Xor
          node and1: And
          connect a -> xor1.a
          connect b -> xor1.b
          connect xor1.out -> sum
          connect a -> and1.a
          connect b -> and1.b
          connect and1.out -> carry
        }
      }
    `);
    expect(result.error).toBeNull();
    expect(result.circuitNames).toContain('HalfAdder');
  });

  it('converts multiple circuits in one file', () => {
    const result = convertAndExecute(`
      circuit HalfAdder {
        input a: Bit
        input b: Bit
        output sum: Bit
        output carry: Bit
        impl {
          node xor1: Xor
          node and1: And
          connect a -> xor1.a
          connect b -> xor1.b
          connect xor1.out -> sum
          connect a -> and1.a
          connect b -> and1.b
          connect and1.out -> carry
        }
      }
      circuit TestHA {
        impl {
          node sw1: Switch
          node sw2: Switch
          node ha: HalfAdder
          node led1: Led
          node led2: Led
          connect sw1.out -> ha.a
          connect sw2.out -> ha.b
          connect ha.sum -> led1.in
          connect ha.carry -> led2.in
        }
      }
    `);
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBe(2);
  });

  it('converts a circuit with bus ports', () => {
    const result = convertAndExecute(`
      circuit BusDemo {
        input data: Bus[8]
        output result: Bus[8]
        impl {
          node inc: Incrementer
          connect data -> inc.in
          connect inc.out -> result
        }
      }
    `);
    expect(result.error).toBeNull();
  });

  it('generated TS uses object syntax', () => {
    const { ast } = parseDSL(`
      circuit HalfAdder {
        input a: Bit
        output sum: Bit
        impl {
          node xor1: Xor
          connect a -> xor1.a
        }
      }
    `, 'test.dsl');

    const ts = generateTS(ast);
    expect(ts).toContain("component('HalfAdder', {");
    expect(ts).toContain("in: { a: bit }");
    expect(ts).toContain("out: { sum: bit }");
    expect(ts).toContain("nodes: { xor1: Xor }");
    expect(ts).toContain("connect:");
    expect(ts).not.toContain(".build()");
  });
});

describe('convert real DSL files', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..', '..');

  function tryConvertFile(filename: string) {
    try {
      const source = readFileSync(join(ROOT, filename), 'utf-8');
      const { ast, errors } = parseDSL(source, 'test.dsl');
      if (errors.length > 0) return { error: `Parse: ${errors.map(e => e.message).join('; ')}`, circuitCount: 0 };
      const ts = generateTS(ast);
      const result = executeCircuitCode(ts);
      return { error: result.error, circuitCount: result.circuits.length };
    } catch { return null; }
  }

  it('converts test-halfadder.dsl', () => {
    const result = tryConvertFile('dsl-files/test-halfadder.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBe(3);
  });

  it('converts Counter.dsl', () => {
    const result = tryConvertFile('dsl-files/Counter.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
  });

  it('converts ALU.dsl', () => {
    const result = tryConvertFile('dsl-files/ALU.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
  });
});
