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
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
  runFlatCombinationalSimulation,
  type FlatSequentialState,
  type FlatPortValueMap,
} from '../lib/flat-simulator';
import { createSnapshot } from '../lib/time-travel';
import type { Circuit } from '../types/ir-v0.1';
import type { SimulationSnapshot } from '../types/simulation-snapshot';
import type { ComponentLibraryStore } from '../stores/component-library-store';
import { usePortValuesStore } from '../stores/port-values-store';
import { useSequentialStateStore } from '../stores/sequential-state-store';
import { useMemoryDataStore } from '../stores/memory-data-store';

/**
 * Check if circuit has sequential components
 */
function hasSequentialComponents(
  circuit: Circuit | null,
  library: ComponentLibraryStore
): boolean {
  if (!circuit) return false;

  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    if (componentDef.clocks.length > 0 || componentDef.state.length > 0) {
      return true;
    }

    if (componentDef.implementation.kind === 'composite') {
      if (hasSequentialComponents(componentDef, library)) {
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
  private seqState: FlatSequentialState | null = null;
  private portValues: FlatPortValueMap = new Map();
  private isSequential = false;

  // Time-travel state
  private history: SimulationSnapshot[] = [];
  private currentHistoryIndex = -1;
  private maxHistorySize = 1000;

  // Memory data generation tracking (for auto-reset on ROM swap)
  private lastMemoryGeneration = 0;

  // Listeners for state changes (React integration)
  private listeners: Set<() => void> = new Set();

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
    console.log('[Controller] Flat circuit has', this.flatCircuit.connections.length, 'connections:');
    for (const conn of this.flatCircuit.connections.slice(0, 10)) {
      console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
    }

    // Sync environmental values
    syncEnvironmentalValues(this.flatCircuit, circuit);

    if (this.isSequential) {
      // Initialize sequential state (cycle 0)
      this.seqState = initializeFlatSequentialState(this.flatCircuit);

      // Compute initial wire values (combinational only, don't tick clock)
      const result = runFlatCombinationalSimulation(this.flatCircuit);
      if (!result.error) {
        this.portValues = result.portValues;
      }

      // Save initial snapshot (cycle 0)
      const initialSnapshot = createSnapshot(this.seqState, circuit);
      this.saveSnapshot(initialSnapshot);
    } else {
      // Combinational circuit
      this.seqState = null;
      this.simulate();
    }

    this.notifyListeners();
  }

  /**
   * Re-elaborate if circuit structure changed (but keep state)
   * Used when adding/removing nodes
   */
  reelaborate(): void {
    if (!this.circuit || !this.library) return;

    this.flatCircuit = elaborate(this.circuit, this.library);
    syncEnvironmentalValues(this.flatCircuit, this.circuit);

    // Re-run simulation with current state
    if (this.isSequential && this.seqState) {
      const result = runFlatSimulationTick(this.flatCircuit, this.seqState);
      if (!result.error) {
        this.portValues = result.portValues;
      }
    } else {
      this.simulate();
    }

    this.notifyListeners();
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

    if (!this.flatCircuit || !this.circuit || !this.library) {
      console.error('[SimulationController] Cannot step: not initialized');
      return;
    }

    if (!this.isSequential) {
      console.warn('[SimulationController] step() called on combinational circuit');
      return;
    }

    if (!this.seqState) {
      console.error('[SimulationController] Cannot step: no sequential state');
      return;
    }

    // If viewing past, return to present before stepping
    if (this.isViewingPast()) {
      this.currentHistoryIndex = this.history.length - 1;
      const snapshot = this.history[this.currentHistoryIndex];
      this.seqState = this.cloneSeqState(snapshot.sequentialState);
    }

    // Sync environmental values
    syncEnvironmentalValues(this.flatCircuit, this.circuit);

    // Execute simulation tick, passing previous port values for change detection
    const result = runFlatSimulationTick(this.flatCircuit, this.seqState, this.portValues);

    if (result.error) {
      console.error('[SimulationController] Simulation error:', result.error);
      return;
    }

    // Store results
    this.portValues = result.portValues;

    if (result.sequentialState) {
      this.seqState = {
        currentState: new Map(result.sequentialState.currentState),
        nextState: new Map(result.sequentialState.nextState),
        clocks: new Map(result.sequentialState.clocks),
        cycleCount: result.sequentialState.cycleCount,
      };

      // Save snapshot
      const snapshot = createSnapshot(this.seqState, this.circuit);
      this.saveSnapshot(snapshot);
    }

    this.notifyListeners();
  }

  /**
   * Simulate combinational circuit
   * Called automatically on input changes for combinational circuits
   */
  simulate(): void {
    console.log('[Controller] simulate() called');
    if (!this.flatCircuit || !this.circuit) {
      console.log('[Controller] No flatCircuit or circuit, skipping simulation');
      return;
    }

    if (this.isSequential) {
      // Sequential circuits use step() instead
      console.log('[Controller] Sequential circuit, use step() instead');
      return;
    }

    console.log('[Controller] Running combinational simulation...');
    syncEnvironmentalValues(this.flatCircuit, this.circuit);

    const result = runFlatCombinationalSimulation(this.flatCircuit);

    if (result.error) {
      console.error('[SimulationController] Simulation error:', result.error);
      this.portValues = new Map();
      return;
    }

    console.log('[Controller] Simulation complete,', result.portValues.size, 'port values');
    // Debug: log all port values
    console.log('[Controller] Port values:');
    for (const [key, value] of result.portValues.entries()) {
      console.log(`  ${key} = ${value}`);
    }
    this.portValues = result.portValues;
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
    if (!this.circuit) return null;

    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      const snapshot = this.history[this.currentHistoryIndex];

      // Restore state
      this.seqState = this.cloneSeqState(snapshot.sequentialState);

      // Recompute wire values based on restored state
      // Use combinational simulation to avoid mutating/incrementing cycle
      if (this.flatCircuit) {
        const result = runFlatCombinationalSimulation(this.flatCircuit, this.seqState);
        if (!result.error) {
          this.portValues = result.portValues;
        }
      }

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
    if (!this.circuit) return null;

    if (this.currentHistoryIndex < this.history.length - 1) {
      this.currentHistoryIndex++;
      const snapshot = this.history[this.currentHistoryIndex];

      // Restore state
      this.seqState = this.cloneSeqState(snapshot.sequentialState);

      // Recompute wire values based on restored state
      // Use combinational simulation to avoid mutating/incrementing cycle
      if (this.flatCircuit) {
        const result = runFlatCombinationalSimulation(this.flatCircuit, this.seqState);
        if (!result.error) {
          this.portValues = result.portValues;
        }
      }

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
    if (!this.circuit) return null;

    const targetIndex = this.history.findIndex((s) => s.cycleNumber === cycleNumber);

    if (targetIndex !== -1) {
      this.currentHistoryIndex = targetIndex;
      const snapshot = this.history[targetIndex];

      // Restore state
      this.seqState = this.cloneSeqState(snapshot.sequentialState);

      // Recompute wire values based on restored state
      // Use combinational simulation to avoid mutating/incrementing cycle
      if (this.flatCircuit) {
        const result = runFlatCombinationalSimulation(this.flatCircuit, this.seqState);
        if (!result.error) {
          this.portValues = result.portValues;
        }
      }

      this.notifyListeners();
      return snapshot;
    }

    return null;
  }

  /**
   * Set input value (for Input/Switch/Button nodes)
   * Updates the flat circuit directly (which we own, not frozen by Immer)
   * Uses incremental propagation for O(K) performance.
   */
  setInput(nodeId: string, value: number): void {
    if (!this.flatCircuit) return;

    // Find the node in the flat circuit (may have same ID or be prefixed)
    const flatNode = this.flatCircuit.nodes.find(
      (n) => n.id === nodeId || n.id.endsWith('.' + nodeId)
    );

    if (flatNode) {
      flatNode.arguments = { ...flatNode.arguments, value };

      // Re-simulate if combinational using incremental propagation
      if (!this.isSequential) {
        // Incremental: only propagate from the changed input node
        const result = runFlatCombinationalSimulation(
          this.flatCircuit,
          this.seqState ?? undefined,
          this.portValues,
          [flatNode.id]  // Seed with just this node
        );
        if (!result.error) {
          this.portValues = result.portValues;
        }
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
