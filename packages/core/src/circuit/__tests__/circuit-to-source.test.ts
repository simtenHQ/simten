import { describe, it, expect } from "vitest";
import { circuit, bit, bus, reg } from "../index.js";
import { circuitToSource, CircuitToSourceError } from "../circuit-to-source.js";
import { And, Or, Not, Xor, Register } from "../../std/index.js";
import { executeCircuitCode } from "../execute.js";

/** Strip imports so executeCircuitCode (which runs in a Function scope with
 *  stdlib pre-injected) doesn't choke on module syntax. The serializer no
 *  longer emits `export`, so only imports need stripping. */
function compileSource(source: string): ReturnType<typeof executeCircuitCode> {
  const stripped = source.replace(/^import\s+[^;]+;\s*$/gm, "");
  return executeCircuitCode(stripped);
}

function roundTrip(built: ReturnType<typeof circuit>): ReturnType<typeof executeCircuitCode> {
  return compileSource(circuitToSource(built));
}

describe("circuitToSource", () => {
  it("serializes a HalfAdder and round-trips", () => {
    const HalfAdder = circuit("HalfAdder", {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x: Xor, a1: And },
      connect: ({ inputs, outputs, nodes: { x, a1 } }) => [
        inputs.a.to(x.a, a1.a),
        inputs.b.to(x.b, a1.b),
        x.out.to(outputs.sum),
        a1.out.to(outputs.carry),
      ],
    });

    const result = roundTrip(HalfAdder);
    expect(result.error).toBeNull();
    expect(result.circuit?.name).toBe("HalfAdder");
    expect(result.circuit?.inputs.map((p) => p.name).sort()).toEqual(["a", "b"]);
    expect(result.circuit?.outputs.map((p) => p.name).sort()).toEqual(["carry", "sum"]);
    expect(result.circuit?.nodes.length).toBe(2);
    // Connection count matches: 4 sources × variable targets, total 6 wires
    expect(result.circuit?.connections.length).toBe(HalfAdder.circuit.connections.length);
  });

  it("serializes a circuit with bus ports", () => {
    const Wide = circuit("Wide", {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { y: bus(8) },
    });
    const source = circuitToSource(Wide);
    expect(source).toContain("a: bus(8)");
    expect(source).toContain("y: bus(8)");
    const result = compileSource(source);
    expect(result.error).toBeNull();
    expect(result.circuit?.inputs[0].portType).toEqual({ kind: "bus", width: 8 });
  });

  it("preserves nodeArgs", () => {
    const WithArgs = circuit("WithArgs", {
      outputs: { q: bit },
      nodes: { r: Register },
      nodeArgs: { r: { initial: 42 } },
      connect: ({ outputs, nodes: { r } }) => [r.q.to(outputs.q)],
    });
    const source = circuitToSource(WithArgs);
    expect(source).toContain("nodeArgs: { r: { initial: 42 } }");
  });

  it("emits state with reg() / mem()", () => {
    const Stateful = circuit("Stateful", {
      outputs: { y: bus(8) },
      state: { counter: reg(8, 5) },
    });
    const source = circuitToSource(Stateful);
    expect(source).toContain("state: { counter: reg(8, 5) }");
  });

  it("emits user dependencies in topological order", () => {
    const SubCircuit = circuit("SubCircuit", {
      inputs: { x: bit },
      outputs: { y: bit },
      nodes: { n1: Not },
      connect: ({ inputs, outputs, nodes: { n1 } }) => [
        inputs.x.to(n1.in),
        n1.out.to(outputs.y),
      ],
    });
    const Parent = circuit("Parent", {
      inputs: { a: bit },
      outputs: { z: bit },
      nodes: { sub: SubCircuit },
      connect: ({ inputs, outputs, nodes: { sub } }) => [
        inputs.a.to(sub.x),
        sub.y.to(outputs.z),
      ],
    });
    const source = circuitToSource(Parent);
    const subIdx = source.indexOf("const SubCircuit");
    const parentIdx = source.indexOf("const Parent");
    expect(subIdx).toBeGreaterThan(-1);
    expect(parentIdx).toBeGreaterThan(subIdx);
    // And it round-trips.
    const result = compileSource(source);
    expect(result.error).toBeNull();
    expect(result.circuits.map((c) => c.name).sort()).toEqual(["Parent", "SubCircuit"]);
  });

  it("groups multi-target connections into a single .to(...) call", () => {
    const Fanout = circuit("Fanout", {
      inputs: { a: bit },
      outputs: { x: bit, y: bit },
      nodes: { o: Or },
      connect: ({ inputs, outputs, nodes: { o } }) => [
        inputs.a.to(o.a, o.b),
        o.out.to(outputs.x, outputs.y),
      ],
    });
    const source = circuitToSource(Fanout);
    expect(source).toContain("inputs.a.to(nodes.o.a, nodes.o.b)");
    expect(source).toContain("nodes.o.out.to(outputs.x, outputs.y)");
  });

  it("emits no import statements (editor sandbox pre-injects scope)", () => {
    const SmallCircuit = circuit("Small", {
      inputs: { a: bit },
      outputs: { y: bit },
      nodes: { n: Not },
      connect: ({ inputs, outputs, nodes: { n } }) => [
        inputs.a.to(n.in),
        n.out.to(outputs.y),
      ],
    });
    const source = circuitToSource(SmallCircuit);
    expect(source).not.toMatch(/^import\b/m);
    expect(source).toContain("Not");
  });

  it("throws on circuits with custom eval (primitive)", () => {
    const Weird = circuit("Weird", {
      inputs: { a: bit },
      outputs: { y: bit },
      eval: ({ a }) => ({ y: a ? 0 : 1 }),
    });
    expect(() => circuitToSource(Weird)).toThrow(CircuitToSourceError);
  });
});
