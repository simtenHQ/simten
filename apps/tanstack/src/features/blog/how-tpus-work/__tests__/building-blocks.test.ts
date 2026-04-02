/**
 * Building Block Circuit Tests
 *
 * Tests that all intermediate teaching circuits in the TPU blog post
 * compile and simulate correctly, using the same PE_Systolic architecture
 * as the final systolic array.
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
import { TPU_CIRCUITS } from "../circuits";

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
  if (!node) throw new Error(`Node '${label}' not found in circuit. Available: ${circuit.nodes.map(n => n.label).join(', ')}`);
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

describe("TPU Blog Building Blocks", () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibraryAdapter;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(PRIMITIVES as any[]);
    library = new ComponentLibraryAdapter(store);
  });

  function compileCircuit(dsl: string) {
    const { ast, errors } = parseDSL(dsl);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    expect(circuits.length).toBeGreaterThanOrEqual(1);
    const circuit = circuits[circuits.length - 1];
    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    return { circuit, sim };
  }

  describe("Multiply-Add Unit", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.multiplyAdd.dsl);
      expect(sim).toBeDefined();
    });

    it("should compute partialSumIn + data × weight combinationally", () => {
      // data=3, weight=5, partialSumIn=10 → result = 10 + 15 = 25
      const { sim } = compileCircuit(TPU_CIRCUITS.multiplyAdd.dsl);
      const result = sim.runCombinational();
      expect(result.error).toBeUndefined();

      const output = getPortValue(result.portValues, "result");
      expect(output).toBe(25);
    });
  });

  describe("Weight Register", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.weightRegister.dsl);
      expect(sim).toBeDefined();
    });

    it("should latch weight when valid is high and hold when valid goes low", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.weightRegister.dsl);
      const validId = findNodeId(circuit, "weightValid");

      // Initially: weight not stored (register = 0), product = 0
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "storedWeight")).toBe(0);

      // Toggle valid on, tick to latch weight (value=7)
      sim.setInput(validId, 1);
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "storedWeight")).toBe(7);
      // Product: dataIn(3) × storedWeight(7) = 21
      expect(getPortValue(sim.getPortValues(), "product")).toBe(21);

      // Toggle valid off, tick — weight should hold at 7
      sim.setInput(validId, 0);
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "storedWeight")).toBe(7);
    });
  });

  describe("Processing Element (PE_Systolic)", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.processingElement.dsl);
      expect(sim).toBeDefined();
    });

    it("should produce registered partialSumOut one cycle after computation", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.processingElement.dsl);
      const validId = findNodeId(circuit, "weightValid");

      // Load weight: dataIn=3, weightIn=5, partialSumIn=0
      sim.setInput(validId, 1);
      sim.tick(); // tick 1: weight latches, psumReg latches 0+3*0=0

      // Weight loaded, partialSumOut still 0 (registered, 1 cycle behind)
      sim.setInput(validId, 0);
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "partialSumOut")).toBe(0);

      // Tick again: psumReg latches 0 + 3*5 = 15
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "partialSumOut")).toBe(15);
    });

    it("should delay dataIn by one cycle through dataPipe", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.processingElement.dsl);
      const validId = findNodeId(circuit, "weightValid");

      // Initially dataOut should be 0 (register default)
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "dataOut")).toBe(0);

      // After one tick, dataIn=3 should appear at dataOut
      sim.setInput(validId, 1);
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "dataOut")).toBe(3);
    });
  });

  describe("Two-PE Row (Horizontal Data Flow)", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.twoPERow.dsl);
      expect(sim).toBeDefined();
    });

    it("should show data pipeline and registered psum delays", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.twoPERow.dsl);
      const validId = findNodeId(circuit, "weightValid");

      // Before weight load: no weights stored, both results = 0
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "result0")).toBe(0);
      expect(getPortValue(sim.getPortValues(), "result1")).toBe(0);

      // Tick 1: Load weights (also latches dataPipe and psumReg)
      sim.setInput(validId, 1);
      sim.tick();
      sim.setInput(validId, 0);

      // After tick 1: psumReg has old value (0+2*0=0). No results yet.
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "result0")).toBe(0);

      // Tick 2: PE0 psumReg latches 0+2*3=6. PE1 psumReg latches 0+2*0=0
      // (PE1 saw pe0.dataOut=2 and weight=5, but pe1 psumReg was 0 last tick)
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "result0")).toBe(6);

      // Tick 3: PE1 psumReg latches 0+2*5=10 (data pipelined through)
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "result1")).toBe(10);
    });
  });

  describe("Two-PE Column (Vertical Partial-Sum Flow)", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.twoPEColumn.dsl);
      expect(sim).toBeDefined();
    });

    it("should cascade partial sums through registers: one PE per cycle", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.twoPEColumn.dsl);
      const validId = findNodeId(circuit, "weightValid");

      // Tick 1: Load weights (weight0=3, weight1=5)
      // psumRegs latch: PE0=0+4*0=0, PE1=0+4*0=0 (weights not loaded yet)
      sim.setInput(validId, 1);
      sim.tick();
      sim.setInput(validId, 0);
      expect(getPortValue(sim.getPortValues(), "topResult")).toBe(0);
      expect(getPortValue(sim.getPortValues(), "bottomResult")).toBe(0);

      // Tick 2: PE0 psumReg latches 0+4*3=12. PE1 sees pe0.partialSumOut=0 (old).
      // PE1 psumReg latches 0+4*5=20.
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "topResult")).toBe(12);
      expect(getPortValue(sim.getPortValues(), "bottomResult")).toBe(20);

      // Tick 3: PE0 psumReg latches 12 again. PE1 sees pe0.partialSumOut=12.
      // PE1 psumReg latches 12+4*5=32 — the full dot product.
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "topResult")).toBe(12);
      expect(getPortValue(sim.getPortValues(), "bottomResult")).toBe(32);
    });
  });

  describe("Wavefront Controller", () => {
    it("should compile without errors", () => {
      const { sim } = compileCircuit(TPU_CIRCUITS.wavefrontController.dsl);
      expect(sim).toBeDefined();
    });

    it("should advance phase when enable is on", () => {
      const { circuit, sim } = compileCircuit(TPU_CIRCUITS.wavefrontController.dsl);
      const enableId = findNodeId(circuit, "enable");

      // Initially phase 0, led0 should be on
      sim.runCombinational();
      expect(getPortValue(sim.getPortValues(), "led0")).toBe(1);
      expect(getPortValue(sim.getPortValues(), "led1")).toBe(0);

      // Enable and tick → phase 1
      sim.setInput(enableId, 1);
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "led1")).toBe(1);
      expect(getPortValue(sim.getPortValues(), "led0")).toBe(0);

      // Tick again → phase 2
      sim.tick();
      expect(getPortValue(sim.getPortValues(), "led2")).toBe(1);
    });
  });
});
