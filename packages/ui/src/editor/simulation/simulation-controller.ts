/**
 * Simulation Controller - Command API for Simulation
 *
 * ARCHITECTURAL INVARIANT:
 * No UI component may import or call simulation functions directly.
 * All simulation is driven via SimulationController commands.
 *
 * This is the simulation kernel - the single authority for:
 * - Executing simulation
 * - Managing time (current cycle, history)
 * - Controlling state (step, run, pause, seek, reset)
 *
 * Like ModelSim/Verilator:
 * - UI issues commands (step, run, seek)
 * - Kernel executes
 * - Kernel records state
 * - UI reads snapshots
 *
 * This can be called from:
 * - UI components (ClockControls, Canvas)
 * - Tests
 * - DevTools
 * - Replay systems
 */

import { elaborate, type FlatCircuit } from '../lib/elaboration';
import type { FlatSequentialState, FlatPortValueMap } from '../lib/flat-simulator';
import { createSnapshot } from '../lib/time-travel';
import type { Circuit } from '../types/circuit';
import type { SimulationSnapshot } from '../types/simulation-snapshot';
import type { ComponentLibraryStore } from '../stores/component-library-store';
import { usePortValuesStore } from '../stores/port-values-store';
import { useSequentialStateStore } from '../stores/sequential-state-store';
import { useMemoryDataStore } from '../stores/memory-data-store';

// Import fast simulator from core (decoupled, no UI deps)
import {
  createSimulator,
  type SimulatorEngine,
  type ComponentLibrary,
} from '@turing-incomplete/core/simulator';

/**
 * Adapt Zustand store to pure ComponentLibrary interface.
 * This keeps the core simulator decoupled from UI state management.
 */
function adaptComponentLibrary(store: ComponentLibraryStore): ComponentLibrary {
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

/**
 * Get memory data from Zustand store as pure Map.
 */
function getMemoryData(): Map<string, Map<number, number>> {
  const storeState = useMemoryDataStore.getState();
  const result = new Map<string, Map<number, number>>();
  for (const [pattern, entry] of storeState.loadedData) {
    result.set(pattern, entry.data);
  }
  return result;
}

/**
 * Check if circuit has sequential components
 */
function hasSequentialComponents(
  circuit: Circuit | null,
  library: ComponentLibraryStore,
  visited: Set<string> = new Set()
): boolean {
  if (!circuit) return false;
  if (visited.has(circuit.name)) return false;
  visited.add(circuit.name);

  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    if (componentDef.clocks.length > 0 || componentDef.state.length > 0) {
      return true;
    }

    if (componentDef.implementation.kind === 'composite') {
      if (hasSequentialComponents(componentDef, library, visited)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sync environmental values (Input/Switch/Button) from live circuit to flat circuit
 */
function syncEnvironmentalValues(flatCircuit: FlatCircuit, liveCircuit: Circuit): void {
  for (const flatNode of flatCircuit.nodes) {
    if (
      flatNode.primitiveType === 'Input' ||
      flatNode.primitiveType === 'Switch' ||
      flatNode.primitiveType === 'Button'
    ) {
      const liveNode = liveCircuit.nodes.find((n) => n.id === flatNode.id);
      if (liveNode && liveNode.arguments.value !== undefined) {
        flatNode.arguments = { ...flatNode.arguments, value: liveNode.arguments.value };
      }
    }
  }
}

/**
 * Simulation Controller - Command API
 *
 * This class manages all simulation execution and time-travel.
 * It's a singleton that can be called from anywhere (UI, tests, etc.)
 * without leaking simulation logic.
 */
export class SimulationController {
  // State (private - never access directly)
  private circuit: Circuit | null = null;
  private library: ComponentLibraryStore | null = null;
  private flatCircuit: FlatCircuit | null = null;
  private isSequential = false;

  // Fast simulator engine (from core - decoupled, no UI deps)
  private simulator: SimulatorEngine | null = null;

  // Time-travel state
  private history: SimulationSnapshot[] = [];
  private currentHistoryIndex = -1;
  private maxHistorySize = 1000;

  // Memory data generation tracking (for auto-reset on ROM swap)
  private lastMemoryGeneration = 0;

  // Listeners for state changes (React integration)
  private listeners: Set<() => void> = new Set();

  // Convenience getters that delegate to simulator
  private get seqState(): FlatSequentialState | null {
    return this.simulator?.getState() ?? null;
  }

  private get portValues(): FlatPortValueMap {
    return this.simulator?.getPortValues() as FlatPortValueMap ?? new Map();
  }

  /**
   * Update circuit reference (for environmental value changes)
   * Call this when circuit values change but structure doesn't
   */
  updateCircuit(circuit: Circuit): void {
    this.circuit = circuit;
  }

  /**
   * Initialize/update circuit
   * Call this when circuit structure changes
   */
  initialize(circuit: Circuit, library: ComponentLibraryStore): void {
    console.log('[Controller] Initializing circuit:', circuit.name, 'nodes:', circuit.nodes.length);
    this.circuit = circuit;
    this.library = library;
    this.isSequential = hasSequentialComponents(circuit, library);

    // Record current memory generation (so we detect future changes)
    this.lastMemoryGeneration = useMemoryDataStore.getState().generation;

    // Clear history on structure change
    this.clearHistory();

    // Elaborate circuit
    console.log('[Controller] Elaborating circuit...');
    this.flatCircuit = elaborate(circuit, library);
    console.log('[Controller] Elaborated to', this.flatCircuit.nodes.length, 'primitive nodes');

    // Sync environmental values
    syncEnvironmentalValues(this.flatCircuit, circuit);

    // Create fast simulator (decoupled core engine)
    const componentLibrary = adaptComponentLibrary(library);
    const memoryData = getMemoryData();
    this.simulator = createSimulator(this.flatCircuit, {
      componentLibrary,
      initialMemory: memoryData,
    });

    if (this.isSequential) {
      // Save initial snapshot (cycle 0)
      const initialSnapshot = createSnapshot(this.seqState!, circuit);
      this.saveSnapshot(initialSnapshot);
    } else {
      // Combinational circuit - run initial simulation
      this.simulator.runCombinational();
    }

    this.notifyListeners();
  }

  /**
   * Re-elaborate if circuit structure changed (but keep state)
   * Used when adding/removing nodes
   */
  reelaborate(): void {
    if (!this.circuit || !this.library) return;

    // For now, just re-initialize (keeps things simple)
    // TODO: Could preserve state across re-elaboration if needed
    this.initialize(this.circuit, this.library);
  }

  // ============================================================================
  // Command API - Public Methods
  // ============================================================================

  /**
   * Check if memory data has changed (e.g., ROM file dropped).
   * If so, trigger a reset - like swapping a ROM chip requires power cycle.
   * Returns true if reset was triggered.
   */
  private checkMemoryDataChanged(): boolean {
    const currentGeneration = useMemoryDataStore.getState().generation;
    if (currentGeneration !== this.lastMemoryGeneration) {
      console.log('[Controller] Memory data changed (generation', this.lastMemoryGeneration, '->', currentGeneration, '), triggering reset');
      this.lastMemoryGeneration = currentGeneration;
      if (this.circuit && this.library) {
        this.initialize(this.circuit, this.library);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute one simulation step (for sequential circuits)
   */
  step(): void {
    // Check if ROM data was swapped - if so, reset (like hardware power cycle)
    if (this.checkMemoryDataChanged()) {
      return; // Reset already happened, don't double-step
    }

    if (!this.flatCircuit || !this.circuit || !this.simulator) {
      console.error('[SimulationController] Cannot step: not initialized');
      return;
    }

    if (!this.isSequential) {
      console.warn('[SimulationController] step() called on combinational circuit');
      return;
    }

    // If viewing past, restore to that state before stepping
    if (this.isViewingPast()) {
      this.currentHistoryIndex = this.history.length - 1;
      const snapshot = this.history[this.currentHistoryIndex];
      this.simulator.restore({
        portValues: new Map(),
        sequentialState: this.cloneSeqState(snapshot.sequentialState),
        cycleCount: snapshot.cycleNumber,
      });
    }

    // Sync environmental values to flat circuit
    syncEnvironmentalValues(this.flatCircuit, this.circuit);

    // Sync input values to simulator
    for (const node of this.flatCircuit.nodes) {
      if (node.primitiveType === 'Input' || node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
        const value = node.arguments.value;
        if (typeof value === 'number' || typeof value === 'boolean') {
          this.simulator.setInput(node.id, value);
        }
      }
    }

    // Execute simulation tick using fast simulator
    const result = this.simulator.tick();

    // Save snapshot
    const seqState = this.simulator.getState();
    if (seqState) {
      const snapshot = createSnapshot(seqState, this.circuit);
      this.saveSnapshot(snapshot);
    }

    this.notifyListeners();
  }

  /**
   * Simulate combinational circuit
   * Called automatically on input changes for combinational circuits
   */
  simulate(): void {
    if (!this.flatCircuit || !this.circuit || !this.simulator) {
      return;
    }

    if (this.isSequential) {
      // Sequential circuits use step() instead
      return;
    }

    // Sync environmental values
    syncEnvironmentalValues(this.flatCircuit, this.circuit);

    // Sync input values to simulator
    for (const node of this.flatCircuit.nodes) {
      if (node.primitiveType === 'Input' || node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
        const value = node.arguments.value;
        if (typeof value === 'number' || typeof value === 'boolean') {
          this.simulator.setInput(node.id, value);
        }
      }
    }

    // Run combinational simulation
    const result = this.simulator.runCombinational();

    if (result.error) {
      console.error('[SimulationController] Simulation error:', result.error);
    }

    this.notifyListeners();
  }

  /**
   * Reset circuit to initial state
   */
  reset(): void {
    if (!this.circuit || !this.library) return;

    this.clearHistory();
    this.initialize(this.circuit, this.library);
  }

  /**
   * Time-travel: step back one cycle
   * Returns the snapshot so caller can restore environmental state
   */
  stepBack(): SimulationSnapshot | null {
    if (!this.circuit || !this.simulator) return null;

    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      const snapshot = this.history[this.currentHistoryIndex];

      // Restore state via simulator
      this.simulator.restore({
        portValues: new Map(),
        sequentialState: this.cloneSeqState(snapshot.sequentialState),
        cycleCount: snapshot.cycleNumber,
      });

      // Recompute wire values based on restored state
      this.simulator.runCombinational();

      this.notifyListeners();
      return snapshot;
    }

    return null;
  }

  /**
   * Time-travel: step forward one cycle
   * Returns the snapshot so caller can restore environmental state
   */
  stepForward(): SimulationSnapshot | null {
    if (!this.circuit || !this.simulator) return null;

    if (this.currentHistoryIndex < this.history.length - 1) {
      this.currentHistoryIndex++;
      const snapshot = this.history[this.currentHistoryIndex];

      // Restore state via simulator
      this.simulator.restore({
        portValues: new Map(),
        sequentialState: this.cloneSeqState(snapshot.sequentialState),
        cycleCount: snapshot.cycleNumber,
      });

      // Recompute wire values based on restored state
      this.simulator.runCombinational();

      this.notifyListeners();
      return snapshot;
    }

    return null;
  }

  /**
   * Time-travel: jump to specific cycle
   * Returns the snapshot so caller can restore environmental state
   */
  seek(cycleNumber: number): SimulationSnapshot | null {
    if (!this.circuit || !this.simulator) return null;

    const targetIndex = this.history.findIndex((s) => s.cycleNumber === cycleNumber);

    if (targetIndex !== -1) {
      this.currentHistoryIndex = targetIndex;
      const snapshot = this.history[targetIndex];

      // Restore state via simulator
      this.simulator.restore({
        portValues: new Map(),
        sequentialState: this.cloneSeqState(snapshot.sequentialState),
        cycleCount: snapshot.cycleNumber,
      });

      // Recompute wire values based on restored state
      this.simulator.runCombinational();

      this.notifyListeners();
      return snapshot;
    }

    return null;
  }

  /**
   * Set input value (for Input/Switch/Button nodes)
   * Updates the IR circuit, flat circuit, and simulator.
   */
  setInput(nodeId: string, value: number | boolean): void {
    if (!this.flatCircuit || !this.simulator) return;

    // Find the node in the flat circuit (may have same ID or be prefixed)
    const flatNode = this.flatCircuit.nodes.find(
      (n) => n.id === nodeId || n.id.endsWith('.' + nodeId)
    );

    if (flatNode) {
      // Update flat circuit (for snapshot/restore consistency)
      flatNode.arguments = { ...flatNode.arguments, value };

      // Update IR circuit too (keeps syncEnvironmentalValues consistent on next step)
      if (this.circuit) {
        const irNode = this.circuit.nodes.find(
          (n) => n.id === nodeId || n.id.endsWith('.' + nodeId)
        );
        if (irNode) {
          irNode.arguments = { ...irNode.arguments, value };
        }
      }

      // Update simulator
      this.simulator.setInput(flatNode.id, value);

      // Re-simulate if combinational
      if (!this.isSequential) {
        this.simulator.runCombinational();
      }

      this.notifyListeners();
    }
  }

  // ============================================================================
  // Query API - Public Read-Only Access
  // ============================================================================

  getPortValues(): FlatPortValueMap {
    return this.portValues;
  }

  getSeqState(): FlatSequentialState | null {
    return this.seqState;
  }

  getCycle(): number {
    return this.seqState?.cycleCount ?? 0;
  }

  getHistory(): SimulationSnapshot[] {
    return this.history;
  }

  getCurrentHistoryIndex(): number {
    return this.currentHistoryIndex;
  }

  isViewingPast(): boolean {
    return this.currentHistoryIndex < this.history.length - 1;
  }

  getIsSequential(): boolean {
    return this.isSequential;
  }

  // ============================================================================
  // React Integration - Subscribe to State Changes
  // ============================================================================

  /**
   * Subscribe to state changes (for React components)
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    // Update stores (so Canvas and other components can subscribe normally)
    usePortValuesStore.getState().setPortValues(this.portValues);
    if (this.seqState) {
      useSequentialStateStore.getState().setSeqState(this.seqState);
    }

    // Also notify direct listeners (for the hook)
    this.listeners.forEach((listener) => listener());
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private saveSnapshot(snapshot: SimulationSnapshot): void {
    if (this.isViewingPast()) {
      // Trim the future: creating new timeline from this point
      this.history = this.history.slice(0, this.currentHistoryIndex + 1);
    }

    this.history.push(snapshot);

    // Ring buffer: drop oldest if exceeding max
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.currentHistoryIndex = this.history.length - 1;
  }

  private clearHistory(): void {
    this.history = [];
    this.currentHistoryIndex = -1;
  }

  private cloneSeqState(state: FlatSequentialState): FlatSequentialState {
    const cloned: FlatSequentialState = {
      currentState: new Map(state.currentState),
      nextState: new Map(state.nextState),
      clocks: new Map(state.clocks),
      cycleCount: state.cycleCount,
    };

    // Deep clone RAM states (Map values)
    for (const [nodeId, value] of state.currentState.entries()) {
      if (value instanceof Map) {
        cloned.currentState.set(nodeId, new Map(value));
      }
    }
    for (const [nodeId, value] of state.nextState.entries()) {
      if (value instanceof Map) {
        cloned.nextState.set(nodeId, new Map(value));
      }
    }

    return cloned;
  }
}

// ============================================================================
// Singleton Instance - THE simulation kernel
// ============================================================================

export const simulationController = new SimulationController();
