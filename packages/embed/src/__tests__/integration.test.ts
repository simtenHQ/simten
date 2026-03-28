/**
 * Integration test for @turing-incomplete/embed
 * Verifies the core pipeline: DSL → compile → elaborate → simulate
 * without any editor stores or Zustand dependencies.
 */

import { describe, it, expect } from "vitest";
import {
  createSimulator,
  elaborate,
  PRIMITIVES,
  type ComponentLibrary,
} from "@turing-incomplete/core/simulator";
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from "@turing-incomplete/core/dsl";
import type { Circuit } from "@turing-incomplete/core/dsl";

/** Same mutable library pattern used by useCircuitSimulator in embed */
function createMutableLibrary(primitives: Circuit[]): ComponentLibrary & DSLComponentLibrary {
  const circuitMap = new Map<string, Circuit>();
  for (const c of primitives) circuitMap.set(c.name, c);

  return {
    resolveComponent: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      Array.from(circuitMap.entries())
        .filter(([, c]) => c.implementation.kind === "primitive")
        .map(([name]) => name),
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => {
      circuitMap.set(circuit.name, circuit);
    },
  };
}

describe("embed standalone pipeline", () => {
  it("compiles and simulates a half adder", () => {
    const dsl = `circuit HalfAdder {
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
}`;

    const library = createMutableLibrary([...PRIMITIVES]);
    const result = compileDSL(dsl, library, "test.dsl");
    expect(result.errors).toHaveLength(0);
    expect(result.circuits).toHaveLength(1);

    const circuit = result.circuits[0];
    expect(circuit.name).toBe("HalfAdder");

    const flat = elaborate(circuit, library);
    const sim = createSimulator(flat, { componentLibrary: library });

    // Test 1+1 = sum:0, carry:1
    sim.setInput("a", true);
    sim.setInput("b", true);
    sim.runCombinational();

    const ports = sim.getPortValues();
    const sum = ports.get("__top__.sum");
    const carry = ports.get("__top__.carry");
    expect(sum).toBe(false); // 1 XOR 1 = 0
    expect(carry).toBe(true); // 1 AND 1 = 1
  });

  it("handles sub-circuits (multi-circuit DSL)", () => {
    const dsl = `
circuit RotateLeft16 {
  input x: Bus[32]
  output out: Bus[32]
  impl {
    node sh_left: LeftShifter(width=32)
    node sh_right: RightShifter(width=32)
    node c16: Constant(value=16, width=32)
    node combine: BusOr(width=32)
    connect x -> sh_left.value
    connect c16.out -> sh_left.shift
    connect x -> sh_right.value
    connect c16.out -> sh_right.shift
    connect sh_left.result -> combine.a
    connect sh_right.result -> combine.b
    connect combine.out -> out
  }
}

circuit RotateDemo {
  input val: Bus[32]
  output result: Bus[32]
  impl {
    node rot: RotateLeft16
    connect val -> rot.x
    connect rot.out -> result
  }
}`;

    const library = createMutableLibrary([...PRIMITIVES]);
    const result = compileDSL(dsl, library, "test.dsl");
    expect(result.errors).toHaveLength(0);
    expect(result.circuits).toHaveLength(2);

    const mainCircuit = result.circuits[1];
    expect(mainCircuit.name).toBe("RotateDemo");

    const flat = elaborate(mainCircuit, library);
    const sim = createSimulator(flat, { componentLibrary: library });

    // RotateLeft16(1) should give 65536 (bit 0 → bit 16)
    sim.setInput("val", 1);
    sim.runCombinational();

    const ports = sim.getPortValues();
    const output = ports.get("__top__.result");
    expect(output).toBe(65536);
  });

  it("per-instance libraries don't cross-contaminate", () => {
    const dslA = `circuit CircuitA {
  input x: Bit
  output y: Bit
  impl {
    node inv: Not
    connect x -> inv.in
    connect inv.out -> y
  }
}`;

    const dslB = `circuit CircuitB {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node gate: And
    connect a -> gate.a
    connect b -> gate.b
    connect gate.out -> out
  }
}`;

    // Create two separate libraries
    const libA = createMutableLibrary([...PRIMITIVES]);
    const libB = createMutableLibrary([...PRIMITIVES]);

    const resultA = compileDSL(dslA, libA, "a.dsl");
    const resultB = compileDSL(dslB, libB, "b.dsl");

    expect(resultA.errors).toHaveLength(0);
    expect(resultB.errors).toHaveLength(0);

    // Library A should have CircuitA but NOT CircuitB
    expect(libA.resolveComponent("CircuitA")).toBeDefined();
    expect(libA.resolveComponent("CircuitB")).toBeUndefined();

    // Library B should have CircuitB but NOT CircuitA
    expect(libB.resolveComponent("CircuitB")).toBeDefined();
    expect(libB.resolveComponent("CircuitA")).toBeUndefined();
  });
});
