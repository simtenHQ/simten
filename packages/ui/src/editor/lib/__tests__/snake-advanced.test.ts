/**
 * SnakeAdvanced Circular Buffer Tests (Pixel Address Storage)
 *
 * Tests the simplified circular buffer implementation that stores pixel addresses
 * instead of X/Y coordinates. This cuts RAM operations in half!
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseDSL, compileToIR, type ComponentLibrary as DSLComponentLibrary } from '@turing-incomplete/core/dsl';
import { createSimulatorFromCircuit, type ComponentLibrary, type FlatSequentialState } from '@turing-incomplete/core/simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { PRIMITIVES } from '@turing-incomplete/core/simulator';
import * as fs from 'fs';
import * as path from 'path';
import type { Circuit } from '../../types/circuit';

// Adapter to make ComponentLibraryStore compatible with ComponentLibrary interface
class ComponentLibraryAdapter implements DSLComponentLibrary {
  constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}

  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveComponent(name);
  }

  hasCircuit(name: string): boolean {
    return this.getCircuit(name) !== undefined;
  }

  getAllComponentNames(): string[] {
    return this.store.getAllComponentNames();
  }
}

function getSimLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('SnakeAdvanced - Pixel Address Storage (4 Phases)', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibraryAdapter;
  let dslCode: string;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(PRIMITIVES as any[]);
    library = new ComponentLibraryAdapter(store);

    // Load SnakeAdvanced.dsl
    const dslPath = path.join(__dirname, '../../../../../../dsl-files/SnakeAdvanced.dsl');
    dslCode = fs.readFileSync(dslPath, 'utf-8');
  });

  // Helper to find node ID by label
  function findNodeId(circuit: Circuit, label: string): string {
    const node = circuit.nodes.find((n) => n.label === label);
    if (!node) {
      throw new Error(`Node with label '${label}' not found`);
    }
    return node.id;
  }

  // Helper to get RAM memory from sequential state
  function getRamMemory(seqState: FlatSequentialState | null, ramId: string): Map<number, number> {
    if (!seqState) return new Map();
    const ramState = seqState.currentState.get(ramId);
    return ramState instanceof Map ? ramState : new Map();
  }

  it('should initialize with 4-segment snake storing pixel addresses', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);

    const circuits = compileToIR(ast, library);
    expect(circuits).toHaveLength(1);
    const circuit = circuits[0];

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const seqState = sim.getState();
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();

    const ramId = findNodeId(circuit, 'ram');
    const ramMemory = getRamMemory(seqState, ramId);
    expect(ramMemory).toBeDefined();

    // NEW STORAGE SCHEME: Body buffer stores pixel addresses (1 byte each)
    expect(ramMemory.get(64)).toBe(33); // Segment 0 (tail): pixel address 33 = (1,4)
    expect(ramMemory.get(65)).toBe(34); // Segment 1: pixel address 34 = (2,4)
    expect(ramMemory.get(66)).toBe(35); // Segment 2: pixel address 35 = (3,4)
    expect(ramMemory.get(67)).toBe(36); // Segment 3 (head): pixel address 36 = (4,4)

    // Framebuffer should have 4 pixels lit
    expect(ramMemory.get(33)).toBe(1); // Pixel at address 33
    expect(ramMemory.get(34)).toBe(1); // Pixel at address 34
    expect(ramMemory.get(35)).toBe(1); // Pixel at address 35
    expect(ramMemory.get(36)).toBe(1); // Pixel at address 36

    // Check initial register values
    const headPtrId = findNodeId(circuit, 'headPtr');
    const tailPtrId = findNodeId(circuit, 'tailPtr');
    const snakeLenId = findNodeId(circuit, 'snakeLen');
    const headXId = findNodeId(circuit, 'headX');
    const headYId = findNodeId(circuit, 'headY');
    const tailPixelAddrId = findNodeId(circuit, 'tailPixelAddr');
    const nextHeadPixelAddrId = findNodeId(circuit, 'nextHeadPixelAddr');

    expect(result.portValues.get(`${headPtrId}.q`)).toBe(3);
    expect(result.portValues.get(`${tailPtrId}.q`)).toBe(0);
    expect(result.portValues.get(`${snakeLenId}.q`)).toBe(4);
    expect(result.portValues.get(`${headXId}.q`)).toBe(4);
    expect(result.portValues.get(`${headYId}.q`)).toBe(4);
    expect(result.portValues.get(`${tailPixelAddrId}.q`)).toBe(33);
    expect(result.portValues.get(`${nextHeadPixelAddrId}.q`)).toBe(36);
  });

  it('should have 4 phases (not 8)', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();

    // Phase counter should start at 0
    const phaseId = findNodeId(circuit, 'phase');
    expect(result.portValues.get(`${phaseId}.q`)).toBe(0);

    // Should have phase detection for 0, 1, 2, 3
    const isPhase0Id = findNodeId(circuit, 'isPhase0');
    const isPhase1Id = findNodeId(circuit, 'isPhase1');
    const isPhase2Id = findNodeId(circuit, 'isPhase2');
    const isPhase3Id = findNodeId(circuit, 'isPhase3');

    expect(result.portValues.get(`${isPhase0Id}.eq`)).toBe(true);
    expect(result.portValues.get(`${isPhase1Id}.eq`)).toBe(false);
    expect(result.portValues.get(`${isPhase2Id}.eq`)).toBe(false);
    expect(result.portValues.get(`${isPhase3Id}.eq`)).toBe(false);
  });

  it('should calculate correct body RAM addresses (1 byte per segment)', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const seqState = sim.getState();
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();

    // tailPtr = 0 initially
    // tailBodyAddr = bodyBase + tailPtr = 64 + 0 = 64
    const tailBodyAddrId = findNodeId(circuit, 'tailBodyAddr');
    expect(result.portValues.get(`${tailBodyAddrId}.sum`)).toBe(64);

    // headPtr = 3 initially
    // headBodyAddr = bodyBase + (headPtr + 1) = 64 + 4 = 68
    // (We write to headPtr + 1 to avoid overwriting current head)
    const headBodyAddrId = findNodeId(circuit, 'headBodyAddr');
    expect(result.portValues.get(`${headBodyAddrId}.sum`)).toBe(68);

    // Check RAM has pixel addresses stored
    const ramId = findNodeId(circuit, 'ram');
    const ramMemory = getRamMemory(seqState, ramId);
    expect(ramMemory.get(64)).toBe(33); // Tail pixel address
    expect(ramMemory.get(67)).toBe(36); // Head pixel address
  });

  it('should calculate next head pixel address when moving right', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    // Enable phase counter and set keyboard to right arrow (77)
    const phaseEnableNode = circuit.nodes.find((n) => n.label === 'phaseEnable');
    phaseEnableNode!.arguments.value = true;

    const keyboardNode = circuit.nodes.find((n) => n.label === 'keyboard');
    keyboardNode!.arguments.value = 77;

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());

    // Run one tick to latch keyboard input (phase 0 -> phase 1)
    // This latches the keyboard value into keyboardLatched register
    sim.tick();

    // Now check that direction is latched and next head calc is correct
    const result = sim.runCombinational();
    expect(result.error).toBeUndefined();

    console.log('\n=== MOVING RIGHT - NEXT HEAD CALCULATION (After Latching) ===');

    // Current head position is (4, 4)
    const headXId = findNodeId(circuit, 'headX');
    const headYId = findNodeId(circuit, 'headY');
    console.log('Current headX.q:', result.portValues.get(`${headXId}.q`));
    console.log('Current headY.q:', result.portValues.get(`${headYId}.q`));

    // Delta should be (+1, 0) for right
    const deltaXId = findNodeId(circuit, 'deltaX');
    const deltaYId = findNodeId(circuit, 'deltaY');
    console.log('deltaX.out:', result.portValues.get(`${deltaXId}.out`));
    console.log('deltaY.out:', result.portValues.get(`${deltaYId}.out`));

    // Next head position should be (5, 4)
    const nextHeadXId = findNodeId(circuit, 'nextHeadX');
    const nextHeadYId = findNodeId(circuit, 'nextHeadY');
    console.log('nextHeadX.out:', result.portValues.get(`${nextHeadXId}.out`));
    console.log('nextHeadY.out:', result.portValues.get(`${nextHeadYId}.out`));

    // Next head pixel address should be 4 * 8 + 5 = 37
    const nextPixelAddrId = findNodeId(circuit, 'nextPixelAddr');
    console.log('nextPixelAddr.sum:', result.portValues.get(`${nextPixelAddrId}.sum`));

    expect(result.portValues.get(`${deltaXId}.out`)).toBe(1);
    expect(result.portValues.get(`${deltaYId}.out`)).toBe(0);
    expect(result.portValues.get(`${nextHeadXId}.out`)).toBe(5);
    expect(result.portValues.get(`${nextHeadYId}.out`)).toBe(4);
    expect(result.portValues.get(`${nextPixelAddrId}.sum`)).toBe(37);
  });

  it('should simulate one complete movement cycle (4 phases)', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    // Set up switches and inputs
    const shouldMoveTailNode = circuit.nodes.find((n) => n.label === 'shouldMoveTail');
    const phaseEnableNode = circuit.nodes.find((n) => n.label === 'phaseEnable');
    const writeEnableNode = circuit.nodes.find((n) => n.label === 'writeEnable');
    const keyboardNode = circuit.nodes.find((n) => n.label === 'keyboard');

    shouldMoveTailNode!.arguments.value = true;   // ON - constant length
    phaseEnableNode!.arguments.value = true;      // ON - enable phase counter
    writeEnableNode!.arguments.value = true;      // ON - enable RAM writes
    keyboardNode!.arguments.value = 77;           // Right arrow

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());

    console.log('\n=== INITIAL STATE (4-Phase Design) ===');
    const ramId = findNodeId(circuit, 'ram');
    let ramMemory = getRamMemory(sim.getState(), ramId);

    console.log('Body buffer:', Array.from(ramMemory.entries())
      .filter(([addr]) => addr >= 64 && addr < 128)
      .sort((a, b) => a[0] - b[0])
    );

    console.log('Framebuffer (pixels lit):',
      Array.from(ramMemory.entries())
        .filter(([addr]) => addr < 64)
        .filter(([_, val]) => val !== 0)
        .sort((a, b) => a[0] - b[0])
    );

    const headXId = findNodeId(circuit, 'headX');
    const headYId = findNodeId(circuit, 'headY');
    const snakeLenId = findNodeId(circuit, 'snakeLen');
    const phaseId = findNodeId(circuit, 'phase');
    const nextHeadPixelAddrId = findNodeId(circuit, 'nextHeadPixelAddr');
    const tailPixelAddrId = findNodeId(circuit, 'tailPixelAddr');

    let result = sim.runCombinational();

    console.log('headX:', result.portValues.get(`${headXId}.q`));
    console.log('headY:', result.portValues.get(`${headYId}.q`));
    console.log('snakeLen:', result.portValues.get(`${snakeLenId}.q`));
    console.log('phase:', result.portValues.get(`${phaseId}.q`));

    // IMPORTANT: Run 4 pre-ticks (one full cycle) to properly propagate keyboard input
    // This is necessary because keyboard latching and next head calculation both
    // happen in phase 0, but on the same clock edge. We need to return to phase 0
    // after keyboard is latched for the next head calculation to use the new value.
    console.log('\n=== PRE-CYCLE (Latch and propagate keyboard input) ===');
    for (let i = 0; i < 4; i++) {
      result = sim.tick();
    }
    console.log('Phase after pre-cycle:', result.portValues.get(`${phaseId}.q`));
    console.log('nextHeadPixelAddr after pre-cycle:', result.portValues.get(`${nextHeadPixelAddrId}.q`));

    // Step through 4 phases (one complete cycle)
    for (let step = 1; step <= 4; step++) {
      console.log(`\n=== STEP ${step} (Phase ${step - 1}) ===`);

      result = sim.tick();
      ramMemory = getRamMemory(sim.getState(), ramId);

      const phase = result.portValues.get(`${phaseId}.q`);
      console.log('Phase after tick:', phase);
      console.log('headX.q:', result.portValues.get(`${headXId}.q`));
      console.log('headY.q:', result.portValues.get(`${headYId}.q`));
      console.log('snakeLen.q:', result.portValues.get(`${snakeLenId}.q`));
      console.log('nextHeadPixelAddr.q:', result.portValues.get(`${nextHeadPixelAddrId}.q`));
      console.log('tailPixelAddr.q:', result.portValues.get(`${tailPixelAddrId}.q`));

      console.log('Framebuffer pixels lit:', Array.from(ramMemory.entries())
        .filter(([addr]) => addr < 64)
        .filter(([_, val]) => val !== 0)
        .map(([addr]) => addr)
        .sort((a, b) => a - b)
      );

      console.log('Body buffer:', Array.from(ramMemory.entries())
        .filter(([addr]) => addr >= 64 && addr < 72)
        .sort((a, b) => a[0] - b[0])
      );
    }

    console.log('\n=== AFTER TWO COMPLETE CYCLES (pre-cycle + 4 steps) ===');

    // After pre-cycle: snake moved from (4,4) to (5,4)
    // After main cycle: snake moved from (5,4) to (6,4)
    // headX should now be 6 (was 4 initially)
    // New head pixel address 38 (6,4) should be lit
    // Old tails 33 (1,4) and 34 (2,4) should be cleared

    expect(result.portValues.get(`${headXId}.q`)).toBe(6);
    expect(result.portValues.get(`${headYId}.q`)).toBe(4);
    expect(result.portValues.get(`${snakeLenId}.q`)).toBe(4);

    // Check framebuffer
    // After two movements right, framebuffer should be: [35, 36, 37, 38]
    expect(ramMemory.get(33)).toBe(0);  // First tail (1,4) cleared in pre-cycle
    expect(ramMemory.get(34)).toBe(0);  // Second tail (2,4) cleared in main cycle
    expect(ramMemory.get(35)).toBe(1);  // (3,4) still lit
    expect(ramMemory.get(36)).toBe(1);  // (4,4) still lit
    expect(ramMemory.get(37)).toBe(1);  // (5,4) still lit
    expect(ramMemory.get(38)).toBe(1);  // New head (6,4) lit

    // Check body buffer updated
    // After two movements, headPtr should be at 5 (started at 3, incremented twice)
    // First move: write to body[64 + (3+1)] = body[68], pixel 37
    // Second move: write to body[64 + (4+1)] = body[69], pixel 38
    // The newest head (pixel 38) should be at body address 69
    expect(ramMemory.get(68)).toBe(37); // First new head
    expect(ramMemory.get(69)).toBe(38); // Second new head (current)
  });

  it('should not grow when stationary (keyboard = 0)', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    const phaseEnableNode = circuit.nodes.find((n) => n.label === 'phaseEnable');
    const writeEnableNode = circuit.nodes.find((n) => n.label === 'writeEnable');
    const shouldMoveTailNode = circuit.nodes.find((n) => n.label === 'shouldMoveTail');
    const keyboardNode = circuit.nodes.find((n) => n.label === 'keyboard');

    phaseEnableNode!.arguments.value = true;
    writeEnableNode!.arguments.value = true;
    shouldMoveTailNode!.arguments.value = true;
    keyboardNode!.arguments.value = 0; // No key pressed

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const ramId = findNodeId(circuit, 'ram');
    const headPtrId = findNodeId(circuit, 'headPtr');
    const snakeLenId = findNodeId(circuit, 'snakeLen');

    // Initial state
    let result = sim.runCombinational();
    const initialHeadPtr = result.portValues.get(`${headPtrId}.q`);
    const initialSnakeLen = result.portValues.get(`${snakeLenId}.q`);

    console.log('Initial headPtr:', initialHeadPtr);
    console.log('Initial snakeLen:', initialSnakeLen);

    // Run 10 cycles while stationary (keyboard = 0)
    for (let i = 0; i < 40; i++) {
      result = sim.tick();
    }

    // After 10 cycles stationary, headPtr and snakeLen should be unchanged
    const finalHeadPtr = result.portValues.get(`${headPtrId}.q`);
    const finalSnakeLen = result.portValues.get(`${snakeLenId}.q`);

    console.log('After 40 ticks (10 cycles):');
    console.log('Final headPtr:', finalHeadPtr);
    console.log('Final snakeLen:', finalSnakeLen);

    expect(finalHeadPtr).toBe(initialHeadPtr);
    expect(finalSnakeLen).toBe(initialSnakeLen);

    // Body buffer should be unchanged
    const ramMemory = getRamMemory(sim.getState(), ramId);
    expect(ramMemory.get(64)).toBe(33); // Original tail
    expect(ramMemory.get(67)).toBe(36); // Original head
    expect(ramMemory.get(68)).toBeUndefined(); // No duplicate entries
  });

  it('should wrap to phase 0 after phase 3', () => {
    const { ast, errors } = parseDSL(dslCode);
    expect(errors).toHaveLength(0);
    const circuits = compileToIR(ast, library);
    const circuit = circuits[0];

    const phaseEnableNode = circuit.nodes.find((n) => n.label === 'phaseEnable');
    phaseEnableNode!.arguments.value = true;

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const phaseId = findNodeId(circuit, 'phase');

    // Initial phase should be 0
    let result = sim.runCombinational();
    expect(result.portValues.get(`${phaseId}.q`)).toBe(0);

    // After 1 tick: phase 1
    result = sim.tick();
    expect(result.portValues.get(`${phaseId}.q`)).toBe(1);

    // After 2 ticks: phase 2
    result = sim.tick();
    expect(result.portValues.get(`${phaseId}.q`)).toBe(2);

    // After 3 ticks: phase 3
    result = sim.tick();
    expect(result.portValues.get(`${phaseId}.q`)).toBe(3);

    // After 4 ticks: back to phase 0
    result = sim.tick();
    expect(result.portValues.get(`${phaseId}.q`)).toBe(0);
  });
});
