/**
 * 3x3 Systolic Array Circuit Tests
 *
 * Tests the 3x3 weight-stationary systolic array:
 * - 9 PEs with registered partial-sum flow (1 cycle per PE vertically)
 * - Staggered data injection: row r starts at cycle 1+r
 * - 9-tick computation (3N for N=3)
 * - Correct matrix multiplication: A×B = C
 *
 * A = [[1,2,3],[4,5,6],[7,8,9]]
 * B = [[2,0,1],[0,2,0],[1,0,2]]
 * C = [[5,4,7],[14,10,16],[23,16,25]]
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parseDSL, compileToIR, type ComponentLibrary as DSLComponentLibrary } from "@/features/dsl";
import {
  createSimulatorFromCircuit,
  type ComponentLibrary,
} from "@turing-incomplete/core/simulator";
import { useComponentLibraryStore } from "@turing-incomplete/ui/editor/stores";
import { getPrimitives } from "@turing-incomplete/ui/editor/lib";
import type { Circuit } from "@turing-incomplete/ui/editor/types";
import { SYSTOLIC_3X3_DSL } from "../circuits";

class ComponentLibraryAdapter implements DSLComponentLibrary {
  constructor(
    private store: ReturnType<typeof useComponentLibraryStore.getState>
  ) {}
  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveComponent(name);
  }
  hasCircuit(name: string): boolean {
    return this.getCircuit(name) !== undefined;
  }
  getAllComponentNames(): string[] {
    return this.store.getAllComponentNames();
  }
  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

function getSimLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

function findNodeId(circuit: Circuit, label: string): string {
  const node = circuit.nodes.find((n) => n.label === label);
  if (!node) throw new Error(`Node '${label}' not found`);
  return node.id;
}

function getPortValue(
  portValues: ReadonlyMap<string, number | boolean>,
  substring: string
): number {
  for (const [key, value] of portValues) {
    if (key.includes(substring)) {
      return typeof value === "number" ? value : value ? 1 : 0;
    }
  }
  return 0;
}

function isDone(portValues: ReadonlyMap<string, number | boolean>): boolean {
  for (const [key, value] of portValues) {
    if (key.includes("done_led")) {
      return !!value;
    }
  }
  return false;
}

describe("3x3 Systolic Array", () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibraryAdapter;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  function compileAndCreate(enableStart = false) {
    const { ast, errors } = parseDSL(SYSTOLIC_3X3_DSL);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    expect(circuits.length).toBeGreaterThanOrEqual(1);
    const circuit = circuits[circuits.length - 1];

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());

    if (enableStart) {
      const startId = findNodeId(circuit, "start");
      sim.setInput(startId, 1);
      sim.runCombinational();
    }

    return { circuit, sim };
  }

  it("should compile without errors", () => {
    const { ast, errors } = parseDSL(SYSTOLIC_3X3_DSL);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    // PE_Systolic, Systolic3x3, TestSystolic3x3
    expect(circuits.length).toBe(3);
  });

  it("should not be done before starting", () => {
    const { sim } = compileAndCreate();
    const result = sim.runCombinational();
    expect(result.error).toBeUndefined();
    expect(isDone(result.portValues)).toBe(false);
  });

  it("should compute [[1,2,3],[4,5,6],[7,8,9]] × [[2,0,1],[0,2,0],[1,0,2]] = [[5,4,7],[14,10,16],[23,16,25]] in 9 ticks", () => {
    const { sim } = compileAndCreate(true);

    // Tick 1: cycle 0 → load weights
    sim.tick();
    // Tick 2: cycle 1 → row 0 first data
    sim.tick();
    // Tick 3: cycle 2 → row 0 second, row 1 first
    sim.tick();
    // Tick 4: cycle 3 → row 0 third, row 1 second, row 2 first
    sim.tick();
    // Tick 5: cycle 4 → C[0][0] captured; row 1 third, row 2 second
    sim.tick();
    // Tick 6: cycle 5 → C[1][0], C[0][1] captured; row 2 third
    sim.tick();
    // Tick 7: cycle 6 → C[2][0], C[1][1], C[0][2] captured
    sim.tick();
    // Tick 8: cycle 7 → C[2][1], C[1][2] captured
    sim.tick();
    // Tick 9: cycle 8 → C[2][2] captured, counter → 9, done fires
    const result = sim.tick();

    expect(isDone(result.portValues)).toBe(true);

    // Row 0: [5, 4, 7]
    expect(getPortValue(result.portValues, "display_c00")).toBe(5);
    expect(getPortValue(result.portValues, "display_c01")).toBe(4);
    expect(getPortValue(result.portValues, "display_c02")).toBe(7);

    // Row 1: [14, 10, 16]
    expect(getPortValue(result.portValues, "display_c10")).toBe(14);
    expect(getPortValue(result.portValues, "display_c11")).toBe(10);
    expect(getPortValue(result.portValues, "display_c12")).toBe(16);

    // Row 2: [23, 16, 25]
    expect(getPortValue(result.portValues, "display_c20")).toBe(23);
    expect(getPortValue(result.portValues, "display_c21")).toBe(16);
    expect(getPortValue(result.portValues, "display_c22")).toBe(25);
  });

  it("should hold results after additional ticks", () => {
    const { sim } = compileAndCreate(true);

    for (let i = 0; i < 9; i++) sim.tick();
    const result = sim.tick(); // 10th tick

    expect(isDone(result.portValues)).toBe(true);
    expect(getPortValue(result.portValues, "display_c00")).toBe(5);
    expect(getPortValue(result.portValues, "display_c22")).toBe(25);
  });

  it("should not start computing until start is enabled", () => {
    const { sim } = compileAndCreate(false);
    const result = sim.tick();
    expect(isDone(result.portValues)).toBe(false);
    expect(getPortValue(result.portValues, "display_c00")).toBe(0);
  });
});
