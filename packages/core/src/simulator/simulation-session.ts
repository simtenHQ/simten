/**
 * SimulationSession — Unified simulation orchestration layer.
 *
 * Wraps a SimulatorEngine and adds:
 * - Snapshot history with time-travel (stepBack, stepForward, seek)
 * - Auto-run with batched ticks at full engine speed, notifying at display rate
 * - subscribe/getState contract compatible with React's useSyncExternalStore
 *
 * Two distinct time domains:
 * - **Simulation clock**: driven by tick(), deterministic, integer cycle count
 * - **UI clock**: driven by auto-run display rate, non-deterministic wall-clock
 *
 * The session stores opaque metadata (TMeta) with each snapshot but never reads it.
 * Consumers (e.g. the editor) define metadata semantics and restore side effects.
 *
 * Architecture:
 *   React UI → SimulationSession (orchestration) → SimulatorEngine (computation)
 */

import type {
  SimulatorEngine,
  SimulatorSnapshot,
  FlatSequentialState,
  BitValue,
  BusValue,
} from '../types/simulator.js';

// ============================================================================
// Public types
// ============================================================================

export interface SessionSnapshot<TMeta = unknown> {
  engineSnapshot: SimulatorSnapshot;
  metadata?: TMeta;
}

export interface SimulationSessionState<TMeta = unknown> {
  // Engine-derived (stable references from engine)
  portValues: ReadonlyMap<string, BitValue | BusValue>;
  sequentialState: FlatSequentialState | null;
  cycle: number;
  isSequential: boolean;

  // Session-managed
  history: readonly SessionSnapshot<TMeta>[];
  historyIndex: number;
  isViewingPast: boolean;
  isRunning: boolean;
  speed: number;
}

export interface SimulationSessionOptions {
  maxHistorySize?: number;
  isSequential?: boolean;
}


// ============================================================================
// SimulationSession
// ============================================================================

const EMPTY_PORT_VALUES: ReadonlyMap<string, BitValue | BusValue> = new Map();

export class SimulationSession<TMeta = unknown> {
  private engine: SimulatorEngine | null;
  private listeners = new Set<() => void>();
  private maxHistorySize: number;

  // Auto-run state (stored on instance, not in closures)
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private accumulator = 0;
  private autoRunOptions: {
    displayRate: number;
    onBeforeTick?: () => void;
    metadataFn?: () => TMeta;
  } | null = null;

  // Cached state — only replaced when something actually changes.
  // getState() returns this reference directly (zero computation).
  private state: SimulationSessionState<TMeta>;

  constructor(engine: SimulatorEngine, options?: SimulationSessionOptions) {
    this.engine = engine;
    this.maxHistorySize = options?.maxHistorySize ?? 1000;

    const isSequential = options?.isSequential ?? false;
    const portValues = engine.getPortValues() ?? EMPTY_PORT_VALUES;
    const sequentialState = engine.getState();

    this.state = {
      portValues,
      sequentialState,
      cycle: sequentialState?.cycleCount ?? 0,
      isSequential,
      history: [],
      historyIndex: -1,
      isViewingPast: false,
      isRunning: false,
      speed: 0,
    };

    // Save initial snapshot for sequential circuits
    if (isSequential) {
      try {
        const snap = engine.snapshot();
        const initial: SessionSnapshot<TMeta> = { engineSnapshot: snap };
        this.state = {
          ...this.state,
          history: [initial],
          historyIndex: 0,
        };
      } catch {
        // Engine doesn't support snapshots — no history
      }
    }
  }

  // ============================================================================
  // State access (stable reference — useSyncExternalStore compatible)
  // ============================================================================

  getState(): SimulationSessionState<TMeta> {
    return this.state;
  }

  // ============================================================================
  // Commands
  // ============================================================================

  tick(metadata?: TMeta): void {
    if (!this.engine) return;
    if (this.state.isRunning) return; // no interleaving with auto-run

    // If viewing past, truncate forward history
    if (this.state.isViewingPast) {
      const truncated = this.state.history.slice(0, this.state.historyIndex + 1);
      this.commitSession({ history: truncated, isViewingPast: false });
    }

    this.engine.tick();
    this.syncFromEngine();
    this.appendSnapshot(metadata);
    this.notifyListeners();
  }

  reset(): void {
    if (!this.engine) return;
    this.stopAutoRun();

    // Preserve ROM contents across reset (like real hardware — flash survives power cycle).
    // Only preserve data that was explicitly loaded via setNode (stored in options.initialMemory).
    // Registers, RAM, UART buffers etc. all clear to defaults.
    this.engine.reset();
    this.syncFromEngine();
    // Engine reset returns to cycle 0
    if (this.state.cycle !== 0) {
      this.state = { ...this.state, cycle: 0 };
    }

    // Rebuild history with initial snapshot
    if (this.state.isSequential) {
      try {
        const snap = this.engine.snapshot();
        const initial: SessionSnapshot<TMeta> = { engineSnapshot: snap };
        this.commitSession({
          history: [initial],
          historyIndex: 0,
          isViewingPast: false,
        });
      } catch {
        this.commitSession({
          history: [],
          historyIndex: -1,
          isViewingPast: false,
        });
      }
    } else {
      this.commitSession({
        history: [],
        historyIndex: -1,
        isViewingPast: false,
      });
    }

    this.notifyListeners();
  }

  setNode(name: string, value: BitValue | BusValue): void {
    if (!this.engine) return;
    this.engine.setNode(name, value);
  }

  runCombinational(): void {
    if (!this.engine) return;
    this.engine.runCombinational();
    if (this.syncFromEngine()) {
      this.notifyListeners();
    }
  }

  // ============================================================================
  // Auto-run (batched ticks at engine speed, notify at display rate)
  // ============================================================================

  startAutoRun(ticksPerSecond: number, options?: {
    displayRate?: number;
    onBeforeTick?: () => void;
    metadataFn?: () => TMeta;
  }): void {
    this.stopAutoRun();
    if (!this.engine || !this.state.isSequential) return;

    // If viewing past, jump to head first
    if (this.state.isViewingPast) {
      const truncated = this.state.history.slice(0, this.state.historyIndex + 1);
      this.commitSession({ history: truncated, isViewingPast: false });
    }

    const displayRate = options?.displayRate ?? 30;
    this.autoRunOptions = {
      displayRate,
      onBeforeTick: options?.onBeforeTick,
      metadataFn: options?.metadataFn,
    };
    this.accumulator = 0;

    this.commitSession({ isRunning: true, speed: ticksPerSecond });

    const msPerFrame = 1000 / displayRate;

    this.intervalId = setInterval(() => {
      if (!this.engine) return;

      // Accumulator-based batching — drift-free
      this.accumulator += ticksPerSecond / displayRate;

      let ticked = false;
      while (this.accumulator >= 1) {
        if (this.autoRunOptions?.onBeforeTick) {
          this.autoRunOptions.onBeforeTick();
        }
        this.engine.tick();
        this.accumulator -= 1;
        ticked = true;
      }

      // Only sync/snapshot/notify when at least one tick happened
      if (ticked) {
        this.syncFromEngine();
        this.appendSnapshot(this.autoRunOptions?.metadataFn?.());
        this.notifyListeners();
      }
    }, msPerFrame);

    this.notifyListeners();
  }

  stopAutoRun(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.autoRunOptions = null;
    this.accumulator = 0;

    if (this.state.isRunning) {
      this.commitSession({ isRunning: false, speed: 0 });
      this.notifyListeners();
    }
  }

  setSpeed(ticksPerSecond: number): void {
    if (!this.state.isRunning || !this.autoRunOptions) return;
    // Restart with new speed — the accumulator resets cleanly
    const opts = this.autoRunOptions;
    this.startAutoRun(ticksPerSecond, {
      displayRate: opts.displayRate,
      onBeforeTick: opts.onBeforeTick,
      metadataFn: opts.metadataFn,
    });
  }

  // ============================================================================
  // Time-travel
  // ============================================================================

  stepBack(): SessionSnapshot<TMeta> | null {
    if (this.state.historyIndex <= 0 || this.state.isRunning) return null;
    return this.seekTo(this.state.historyIndex - 1);
  }

  stepForward(): SessionSnapshot<TMeta> | null {
    if (this.state.historyIndex >= this.state.history.length - 1 || this.state.isRunning) return null;
    return this.seekTo(this.state.historyIndex + 1);
  }

  seek(index: number): SessionSnapshot<TMeta> | null {
    if (index < 0 || index >= this.state.history.length || this.state.isRunning) return null;
    return this.seekTo(index);
  }

  // ============================================================================
  // Subscription (useSyncExternalStore compatible)
  // ============================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  dispose(): void {
    this.stopAutoRun();
    this.listeners.clear();
    this.engine = null;
  }

  /** Direct access to the underlying engine (for checks, advanced use). */
  getEngine(): SimulatorEngine | null {
    return this.engine;
  }

  // ============================================================================
  // Internal — two mutation paths
  // ============================================================================

  /**
   * Read engine state. Only replaces references if they actually changed.
   * Returns true if state was updated.
   */
  private syncFromEngine(): boolean {
    if (!this.engine) return false;

    const portValues = this.engine.getPortValues();
    const sequentialState = this.engine.getState();
    const cycle = sequentialState?.cycleCount ?? 0;

    if (
      portValues !== this.state.portValues ||
      sequentialState !== this.state.sequentialState ||
      cycle !== this.state.cycle
    ) {
      this.state = { ...this.state, portValues, sequentialState, cycle };
      return true;
    }
    return false;
  }

  /**
   * Update session-managed state (history, running, etc.).
   * Does NOT notify — caller must call notifyListeners() explicitly.
   */
  private commitSession(
    changes: Partial<Pick<SimulationSessionState<TMeta>,
      'history' | 'historyIndex' | 'isViewingPast' | 'isRunning' | 'speed'
    >>
  ): void {
    this.state = { ...this.state, ...changes };
  }

  /**
   * Append a snapshot to history. Handles ring buffer truncation.
   * Snapshot = engine state AFTER tick + metadata for that tick.
   */
  private appendSnapshot(metadata?: TMeta): void {
    if (!this.engine || !this.state.isSequential) return;

    try {
      const engineSnapshot = this.engine.snapshot();
      const snapshot: SessionSnapshot<TMeta> = {
        engineSnapshot,
        ...(metadata !== undefined ? { metadata } : {}),
      };

      let history = [...this.state.history, snapshot];

      // Ring buffer: drop oldest if over limit
      if (history.length > this.maxHistorySize) {
        history = history.slice(history.length - this.maxHistorySize);
      }

      this.commitSession({
        history,
        historyIndex: history.length - 1,
        isViewingPast: false,
      });
    } catch {
      // Engine doesn't support snapshots
    }
  }

  /**
   * Seek to a specific history index. Restores engine state.
   */
  private seekTo(index: number): SessionSnapshot<TMeta> | null {
    if (!this.engine) return null;

    const snapshot = this.state.history[index];
    if (!snapshot) return null;

    this.engine.restore(snapshot.engineSnapshot);
    // Read cycle from the snapshot we're restoring (engine cache may be stale)
    const portValues = this.engine.getPortValues();
    const sequentialState = this.engine.getState();
    const cycle = snapshot.engineSnapshot.cycleCount;
    this.state = { ...this.state, portValues, sequentialState, cycle };
    this.commitSession({
      historyIndex: index,
      isViewingPast: index < this.state.history.length - 1,
    });
    this.notifyListeners();

    return snapshot;
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
