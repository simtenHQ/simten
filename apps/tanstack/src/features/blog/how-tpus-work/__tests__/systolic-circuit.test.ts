/**
 * Systolic Array Circuit Tests
 *
 * Tests the weight-stationary systolic array with registered partial sums:
 * - PE_Systolic with registered partial-sum output
 * - Systolic2x2 with 6-tick computation (3N for N=2)
 * - Staggered data injection: row r starts at cycle 1+r
 * - Correct matrix multiplication: A×B = C
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parseDSL, compileToIR, type ComponentLibrary as DSLComponentLibrary } from "@/features/dsl";
import {
  createSimulatorFromCircuit,
  type ComponentLibrary,
} from "@turing-incomplete/core/simulator";
import { useComponentLibraryStore } from "@turing-incomplete/ui/editor/stores";
import { PRIMITIVES } from "@turing-incomplete/ui/editor/lib";
import type { Circuit } from "@turing-incomplete/ui/editor/types";
import { SYSTOLIC_2X2_DSL as SYSTOLIC_DSL } from "../circuits";

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

describe("Systolic Array Circuit", () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibraryAdapter;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(PRIMITIVES as any[]);
    library = new ComponentLibraryAdapter(store);
  });

  function compileAndCreate(enableStart = false) {
    const { ast, errors } = parseDSL(SYSTOLIC_DSL);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    // PE_Systolic, Systolic2x2, TestWavefront
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

  describe("compilation", () => {
    it("should compile the SYSTOLIC_DSL without errors", () => {
      const { ast, errors } = parseDSL(SYSTOLIC_DSL);
      expect(errors).toHaveLength(0);
      const circuits = compileToIR(ast, library);
      expect(circuits.length).toBeGreaterThanOrEqual(1);
    });

    it("should create a simulator from the compiled circuit", () => {
      const { sim } = compileAndCreate();
      expect(sim).toBeDefined();
    });
  });

  describe("initial state", () => {
    it("should not be done before starting", () => {
      const { sim } = compileAndCreate();
      const result = sim.runCombinational();
      expect(result.error).toBeUndefined();
      expect(isDone(result.portValues)).toBe(false);
    });
  });

  describe("matrix multiplication A×B = C", () => {
    it("should compute [[1,2],[3,4]] × [[5,6],[7,8]] = [[19,22],[43,50]] in 6 ticks", () => {
      const { sim } = compileAndCreate(true);

      // Tick 1: cycle 0 → load weights
      sim.tick();
      // Tick 2: cycle 1 → row 0 first data
      sim.tick();
      // Tick 3: cycle 2 → row 0 second data, row 1 first data
      sim.tick();
      // Tick 4: cycle 3 → row 1 second data; C[0][0] captured
      sim.tick();
      // Tick 5: cycle 4 → C[1][0] and C[0][1] captured
      sim.tick();
      // Tick 6: cycle 5 → C[1][1] captured, counter → 6, done fires
      const result = sim.tick();

      // After 6 ticks, done should be true and results correct
      expect(isDone(result.portValues)).toBe(true);

      // Read results from HexDisplay nodes
      const c00 = getPortValue(result.portValues, "display_c00");
      const c01 = getPortValue(result.portValues, "display_c01");
      const c10 = getPortValue(result.portValues, "display_c10");
      const c11 = getPortValue(result.portValues, "display_c11");

      expect(c00).toBe(19);
      expect(c01).toBe(22);
      expect(c10).toBe(43);
      expect(c11).toBe(50);
    });

    it("should stay done and hold results after additional ticks", () => {
      const { sim } = compileAndCreate(true);

      // Run 6 ticks to complete
      for (let i = 0; i < 6; i++) sim.tick();

      // Run a few more ticks — results should hold
      const result = sim.tick();
      expect(isDone(result.portValues)).toBe(true);

      const c00 = getPortValue(result.portValues, "display_c00");
      const c01 = getPortValue(result.portValues, "display_c01");
      const c10 = getPortValue(result.portValues, "display_c10");
      const c11 = getPortValue(result.portValues, "display_c11");

      expect(c00).toBe(19);
      expect(c01).toBe(22);
      expect(c10).toBe(43);
      expect(c11).toBe(50);
    });

    it("should not start computing until start is enabled", () => {
      const { sim } = compileAndCreate(false);

      // Tick without starting — nothing should happen
      const result = sim.tick();
      expect(isDone(result.portValues)).toBe(false);

      // Results should all be 0
      const c00 = getPortValue(result.portValues, "display_c00");
      expect(c00).toBe(0);
    });
  });
});
