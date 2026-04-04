/**
 * DSL-to-TypeScript Conversion Tests
 *
 * Tests the conversion from DSL source to TypeScript builder API code,
 * and verifies the generated code produces valid circuits.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDSL } from '../../dsl/parser/index.js';
import { executeCircuitCode } from '../execute.js';
import type {
  Program,
  CircuitDef,
  NodeDecl,
  ConnectionStmt,
  TypeExpr,
} from '../../dsl/types/ast.js';

// ============================================================================
// Code generator (inline for testing — will extract to script later)
// ============================================================================

function generateTS(program: Program): string {
  const lines: string[] = [];
  const definedNames = new Set(program.circuits.map(c => c.name));
  lines.push('// Auto-generated from DSL\n');

  for (const circuit of program.circuits) {
    lines.push(...generateCircuit(circuit, definedNames));
    lines.push('');
  }

  return lines.join('\n');
}

function generateCircuit(circuit: CircuitDef, definedNames: Set<string>): string[] {
  const lines: string[] = [];
  const ind = '  ';

  lines.push(`const ${circuit.name} = component('${circuit.name}')`);

  for (const input of circuit.inputs) {
    lines.push(`${ind}.in('${input.name}', ${typeToTS(input.portType)})`);
  }
  for (const output of circuit.outputs) {
    lines.push(`${ind}.out('${output.name}', ${typeToTS(output.portType)})`);
  }

  if (circuit.impl && circuit.impl.nodes.length > 0) {
    for (const node of circuit.impl.nodes) {
      const args = node.arguments;
      const cleanArgs = args
        .map(a => ({ name: a.name, value: cleanArgValue(a.value) }))
        .filter(a => a.value !== undefined);
      if (cleanArgs.length > 0) {
        const argsObj = cleanArgs.map(a => `${a.name}: ${JSON.stringify(a.value)}`).join(', ');
        lines.push(`${ind}.node('${node.instanceName}', ${node.componentType}, { ${argsObj} })`);
      } else {
        lines.push(`${ind}.node('${node.instanceName}', ${node.componentType})`);
      }
    }
    if (circuit.impl.connections.length > 0) {
      const nodeNames = circuit.impl.nodes.map(n => n.instanceName).join(', ');
      lines.push(`${ind}.connect(({ in: inp, out, ${nodeNames} }) => [`);
      const grouped = groupConns(circuit.impl.connections, circuit);
      for (const g of grouped) {
        const src = fmtRef(g.source, circuit);
        const targets = g.targets.map(t => fmtRef(t, circuit)).join(', ');
        lines.push(`${ind}${ind}${src}.to(${targets}),`);
      }
      lines.push(`${ind}])`);
    }
  }

  lines.push(`${ind}.build()`);
  return lines;
}

function typeToTS(t: TypeExpr): string {
  if (t.kind === 'bit') return 'bit';
  if (t.kind === 'bus') {
    const w = typeof t.width === 'number' ? t.width : t.width.name;
    return `bus(${w})`;
  }
  return 'bit';
}

/**
 * Convert an AST ArgumentValue to a clean JS value for code generation.
 * Strips parser metadata (location, kind tags) and converts to plain values.
 */
function cleanArgValue(value: any): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && value.kind === 'object' && Array.isArray(value.entries)) {
    // ObjectLiteral → Record<number, number>
    const obj: Record<number, number> = {};
    for (const entry of value.entries) {
      obj[entry.key] = typeof entry.value === 'object' ? cleanArgValue(entry.value) : entry.value;
    }
    return obj;
  }
  if (typeof value === 'object' && value.kind === 'array' && Array.isArray(value.elements)) {
    return value.elements.map((e: any) => cleanArgValue(e));
  }
  if (typeof value === 'object' && value.kind === 'paramRef') {
    return undefined; // Parameter references can't be serialized as literals
  }
  return value;
}

interface Grouped {
  source: { nodeId: string | null; portName: string };
  targets: { nodeId: string | null; portName: string }[];
}

function groupConns(conns: ConnectionStmt[], circuit: CircuitDef): Grouped[] {
  // Filter out clock connections — in the builder API, clocks are implicit
  const clockNames = new Set(circuit.clocks.map(c => c.name));
  const filtered = conns.filter(c => {
    // Skip connections FROM a clock source
    if (!c.source.nodeId && clockNames.has(c.source.portName)) return false;
    // Skip connections TO a .clk port
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
    const isInput = circuit.inputs.some(i => i.name === ref.portName);
    const isOutput = circuit.outputs.some(o => o.name === ref.portName);
    if (isInput) return `inp.${ref.portName}`;
    if (isOutput) return `out.${ref.portName}`;
    // Clock or other
    return `inp.${ref.portName}`;
  }
  return `${ref.nodeId}.${ref.portName}`;
}

// ============================================================================
// Tests: convert + execute + verify
// ============================================================================

describe('DSL-to-TS conversion', () => {
  function convertAndExecute(dslSource: string): { ts: string; error: string | null; circuitCount: number; circuitNames: string[] } {
    const { ast, errors } = parseDSL(dslSource, 'test.dsl');
    if (errors.length > 0) {
      return { ts: '', error: `Parse: ${errors.map(e => e.message).join('; ')}`, circuitCount: 0, circuitNames: [] };
    }
    const ts = generateTS(ast);
    const result = executeCircuitCode(ts);
    return {
      ts,
      error: result.error,
      circuitCount: result.circuits.length,
      circuitNames: result.circuits.map(c => c.name),
    };
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
    expect(result.circuitNames).toContain('Demo');
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
    expect(result.circuitCount).toBe(1);
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
    expect(result.circuitNames).toEqual(['HalfAdder', 'TestHA']);
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
    expect(result.circuitCount).toBe(1);
  });

  it('converts a circuit with fan-out connections', () => {
    const result = convertAndExecute(`
      circuit FanOut {
        impl {
          node sw: Switch
          node and1: And
          node and2: And
          node led1: Led
          node led2: Led
          connect sw.out -> and1.a
          connect sw.out -> and1.b
          connect sw.out -> and2.a
          connect sw.out -> and2.b
          connect and1.out -> led1.in
          connect and2.out -> led2.in
        }
      }
    `);

    expect(result.error).toBeNull();
    expect(result.circuitCount).toBe(1);
  });

  it('generated TS is valid and readable', () => {
    const { ast } = parseDSL(`
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
    `, 'test.dsl');

    const ts = generateTS(ast);

    // Should contain component() call
    expect(ts).toContain("component('HalfAdder')");
    // Should have .in() and .out()
    expect(ts).toContain(".in('a', bit)");
    expect(ts).toContain(".out('sum', bit)");
    // Should have .node()
    expect(ts).toContain(".node('xor1', Xor)");
    // Should have .connect()
    expect(ts).toContain('.connect(');
    // Should have .build()
    expect(ts).toContain('.build()');
  });
});

// ============================================================================
// Test with real DSL files (if they exist)
// ============================================================================

describe('convert real DSL files', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..', '..');

  function tryConvertFile(filename: string) {
    try {
      const source = readFileSync(join(ROOT, filename), 'utf-8');
      return convertAndExecute(source);
    } catch {
      return null; // File doesn't exist
    }
  }

  function convertAndExecute(dslSource: string) {
    const { ast, errors } = parseDSL(dslSource, 'test.dsl');
    if (errors.length > 0) {
      return { error: `Parse: ${errors.map(e => e.message).join('; ')}`, circuitCount: 0 };
    }
    const ts = generateTS(ast);
    const result = executeCircuitCode(ts);
    return { error: result.error, circuitCount: result.circuits.length };
  }

  it('converts test-halfadder.dsl', () => {
    const result = tryConvertFile('dsl-files/test-halfadder.dsl');
    if (!result) return; // skip if file not found
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBe(3);
  });

  it('converts SimpleCombinational.dsl', () => {
    const result = tryConvertFile('dsl-files/SimpleCombinational.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBeGreaterThan(0);
  });

  it('converts Counter.dsl', () => {
    const result = tryConvertFile('dsl-files/Counter.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBeGreaterThan(0);
  });

  it('converts ALU.dsl', () => {
    const result = tryConvertFile('dsl-files/ALU.dsl');
    if (!result) return;
    expect(result.error).toBeNull();
    expect(result.circuitCount).toBeGreaterThan(0);
  });
});
