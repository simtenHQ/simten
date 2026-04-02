/**
 * SimulationSession Tests
 *
 * Tests the unified simulation orchestration layer:
 * - tick + state updates
 * - getState() identity stability
 * - history / time-travel
 * - auto-run batching
 * - subscribe/notify contract
 * - dispose cleanup
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SimulationSession,
  createSimulator,
  createComponentLibrary,
  elaborate,
  PRIMITIVES,
  type SimulatorEngine,
} from '../index.js';
import { compileDSL } from '../../dsl/index.js';

// ── Helpers ──

function createShiftRegister(): SimulatorEngine {
  const lib = createComponentLibrary(PRIMITIVES as any[]);
  const dsl = `circuit SR {
    input d: Bit
    clock clk
    output q0: Bit
    output q1: Bit
    impl {
      node ff0: DFlipFlop
      node ff1: DFlipFlop
      connect d -> ff0.d
      connect clk -> ff0.clk
      connect ff0.q -> ff1.d
      connect clk -> ff1.clk
      connect ff0.q -> q0
      connect ff1.q -> q1
    }
  }`;
  const result = compileDSL(dsl, lib, 'test.dsl');
  const circuit = result.circuits[result.circuits.length - 1];
  const flat = elaborate(circuit, lib);
  return createSimulator(flat, { componentLibrary: lib });
}

function createAndGate(): SimulatorEngine {
  const lib = createComponentLibrary(PRIMITIVES as any[]);
  const dsl = `circuit Demo {
    input a: Bit
    input b: Bit
    output out: Bit
    impl {
      node and1: And
      connect a -> and1.a
      connect b -> and1.b
      connect and1.out -> out
    }
  }`;
  const result = compileDSL(dsl, lib, 'test.dsl');
  const circuit = result.circuits[result.circuits.length - 1];
  const flat = elaborate(circuit, lib);
  return createSimulator(flat, { componentLibrary: lib });
}

// ── Tests ──

describe('SimulationSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('construction', () => {
    it('initializes with engine state', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const state = session.getState();

      expect(state.isSequential).toBe(true);
      expect(state.cycle).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.isViewingPast).toBe(false);
      expect(state.portValues).toBeDefined();

      session.dispose();
    });

    it('saves initial snapshot for sequential circuits', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const state = session.getState();

      expect(state.history.length).toBe(1);
      expect(state.historyIndex).toBe(0);

      session.dispose();
    });

    it('no history for combinational circuits', () => {
      const engine = createAndGate();
      const session = new SimulationSession(engine, { isSequential: false });
      const state = session.getState();

      expect(state.history.length).toBe(0);
      expect(state.historyIndex).toBe(-1);

      session.dispose();
    });
  });

  describe('getState() identity stability', () => {
    it('returns same reference when nothing changed', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      const a = session.getState();
      const b = session.getState();
      expect(a).toBe(b);

      session.dispose();
    });

    it('nested portValues reference is stable when unchanged', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      const a = session.getState();
      const b = session.getState();
      expect(a.portValues).toBe(b.portValues);
      expect(a.history).toBe(b.history);

      session.dispose();
    });

    it('returns new reference after tick', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      const before = session.getState();
      session.tick();
      const after = session.getState();

      expect(before).not.toBe(after);
      expect(after.cycle).toBeGreaterThan(before.cycle);

      session.dispose();
    });
  });

  describe('tick', () => {
    it('increments cycle and updates portValues', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.tick();
      const state = session.getState();
      expect(state.cycle).toBe(1);

      session.tick();
      expect(session.getState().cycle).toBe(2);

      session.dispose();
    });

    it('appends to history', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      expect(session.getState().history.length).toBe(1); // initial
      session.tick();
      expect(session.getState().history.length).toBe(2);
      session.tick();
      expect(session.getState().history.length).toBe(3);

      session.dispose();
    });

    it('stores metadata in snapshot', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession<string>(engine, { isSequential: true });

      session.tick('hello');
      session.tick('world');

      const state = session.getState();
      expect(state.history[1].metadata).toBe('hello');
      expect(state.history[2].metadata).toBe('world');

      session.dispose();
    });

    it('is no-op during auto-run', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.startAutoRun(10, { displayRate: 10 });
      const cycleBefore = session.getState().cycle;
      session.tick(); // should be ignored
      // cycle unchanged because tick was no-op (auto-run hasn't fired yet)
      expect(session.getState().cycle).toBe(cycleBefore);

      session.dispose();
    });
  });

  describe('reset', () => {
    it('resets cycle and history', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.tick();
      session.tick();
      session.tick();
      expect(session.getState().cycle).toBeGreaterThan(0);

      session.reset();
      const state = session.getState();
      expect(state.cycle).toBe(0);
      expect(state.history.length).toBe(1); // fresh initial snapshot
      expect(state.historyIndex).toBe(0);
      expect(state.isRunning).toBe(false);

      session.dispose();
    });
  });

  describe('history / time-travel', () => {
    it('stepBack restores previous state', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.tick();
      session.tick();
      session.tick();
      const cycleAt3 = session.getState().cycle;
      expect(cycleAt3).toBe(3);

      const snap = session.stepBack();
      expect(snap).not.toBeNull();
      expect(session.getState().cycle).toBe(2);
      expect(session.getState().isViewingPast).toBe(true);
      expect(session.getState().historyIndex).toBe(2); // 0=initial, 1=tick1, 2=tick2

      session.dispose();
    });

    it('stepForward after stepBack', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.tick();
      session.tick();
      session.tick();

      session.stepBack();
      session.stepBack();
      expect(session.getState().cycle).toBe(1);

      session.stepForward();
      expect(session.getState().cycle).toBe(2);

      session.dispose();
    });

    it('seek to specific index', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      for (let i = 0; i < 5; i++) session.tick();
      expect(session.getState().cycle).toBe(5);

      session.seek(1);
      expect(session.getState().cycle).toBe(1);
      expect(session.getState().isViewingPast).toBe(true);

      session.seek(4);
      expect(session.getState().cycle).toBe(4);

      session.dispose();
    });

    it('tick while viewing past truncates forward history', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      for (let i = 0; i < 5; i++) session.tick();
      expect(session.getState().history.length).toBe(6); // initial + 5

      session.seek(2); // go back to cycle 2
      session.tick();  // new tick from cycle 2

      // Forward history (indices 3-5) should be gone
      // History: initial, tick1, tick2, new_tick
      expect(session.getState().history.length).toBe(4);
      expect(session.getState().isViewingPast).toBe(false);

      session.dispose();
    });

    it('stepBack returns null at beginning', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      expect(session.stepBack()).toBeNull();

      session.dispose();
    });

    it('stepForward returns null at head', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.tick();
      expect(session.stepForward()).toBeNull();

      session.dispose();
    });

    it('returns metadata from time-travel', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession<string>(engine, { isSequential: true });

      session.tick('first');
      session.tick('second');
      session.tick('third');

      const snap = session.stepBack();
      expect(snap?.metadata).toBe('second');

      session.dispose();
    });
  });

  describe('history ring buffer', () => {
    it('respects maxHistorySize', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, {
        isSequential: true,
        maxHistorySize: 5,
      });

      for (let i = 0; i < 10; i++) session.tick();

      expect(session.getState().history.length).toBe(5);
      expect(session.getState().historyIndex).toBe(4); // last index

      session.dispose();
    });
  });

  describe('subscribe / notify', () => {
    it('notifies on tick', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();

      session.subscribe(listener);
      session.tick();

      expect(listener).toHaveBeenCalledTimes(1);

      session.dispose();
    });

    it('unsubscribe stops notifications', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();

      const unsub = session.subscribe(listener);
      session.tick();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      session.tick();
      expect(listener).toHaveBeenCalledTimes(1); // no change

      session.dispose();
    });

    it('notifies on reset', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();

      session.subscribe(listener);
      session.reset();

      expect(listener).toHaveBeenCalledTimes(1);

      session.dispose();
    });

    it('notifies on time-travel', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();

      session.tick();
      session.tick();

      session.subscribe(listener);
      session.stepBack();

      expect(listener).toHaveBeenCalledTimes(1);

      session.dispose();
    });
  });

  describe('auto-run', () => {
    it('batches ticks and notifies once per frame', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();
      session.subscribe(listener);

      // 100 ticks/sec at 10fps = 10 ticks per frame
      session.startAutoRun(100, { displayRate: 10 });
      expect(listener).toHaveBeenCalledTimes(1); // initial notify for isRunning

      // Advance one frame (100ms at 10fps)
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(2); // one frame notification
      expect(session.getState().cycle).toBeGreaterThan(0);

      session.dispose();
    });

    it('stopAutoRun clears interval', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.startAutoRun(100, { displayRate: 10 });
      expect(session.getState().isRunning).toBe(true);

      session.stopAutoRun();
      expect(session.getState().isRunning).toBe(false);

      const cycleBefore = session.getState().cycle;
      vi.advanceTimersByTime(500);
      expect(session.getState().cycle).toBe(cycleBefore); // no more ticks

      session.dispose();
    });

    it('calls onBeforeTick before each tick', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const beforeTick = vi.fn();

      session.startAutoRun(10, { displayRate: 10, onBeforeTick: beforeTick });
      vi.advanceTimersByTime(100); // one frame

      expect(beforeTick).toHaveBeenCalled();

      session.dispose();
    });

    it('setSpeed restarts with new speed', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.startAutoRun(10, { displayRate: 10 });
      vi.advanceTimersByTime(100);
      const cycleAfterSlow = session.getState().cycle;

      session.setSpeed(1000);
      vi.advanceTimersByTime(100);
      const cycleAfterFast = session.getState().cycle;

      expect(cycleAfterFast - cycleAfterSlow).toBeGreaterThan(cycleAfterSlow);

      session.dispose();
    });
  });

  describe('dispose', () => {
    it('cleans up intervals and listeners', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const listener = vi.fn();

      session.subscribe(listener);
      session.startAutoRun(100, { displayRate: 10 });

      session.dispose();

      vi.advanceTimersByTime(500);
      // listener should have been called for startAutoRun notify, but not after dispose
      const callCount = listener.mock.calls.length;
      vi.advanceTimersByTime(500);
      expect(listener).toHaveBeenCalledTimes(callCount); // no new calls

      expect(session.getEngine()).toBeNull();
    });
  });

  describe('combinational circuits', () => {
    it('runCombinational updates portValues and notifies', () => {
      const engine = createAndGate();
      const session = new SimulationSession(engine, { isSequential: false });
      const listener = vi.fn();
      session.subscribe(listener);

      session.setInput('a', true);
      session.setInput('b', true);
      session.runCombinational();

      expect(listener).toHaveBeenCalledTimes(1);

      session.dispose();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Editor-like scenarios (the exact flows that were buggy)
  // ════════════════════════════════════════════════════════════════════

  describe('editor scenarios', () => {
    it('setInput during auto-run does not stop ticking', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      session.startAutoRun(100, { displayRate: 10 });
      vi.advanceTimersByTime(100); // one frame
      const cycleAfterFrame1 = session.getState().cycle;
      expect(cycleAfterFrame1).toBeGreaterThan(0);

      // Simulate keyboard input (setInput without stopping auto-run)
      session.setInput('d', true);
      vi.advanceTimersByTime(100); // another frame
      const cycleAfterFrame2 = session.getState().cycle;
      expect(cycleAfterFrame2).toBeGreaterThan(cycleAfterFrame1);

      // Still running
      expect(session.getState().isRunning).toBe(true);

      session.dispose();
    });

    it('tick works after session creation (not null)', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      expect(session.getState().cycle).toBe(0);
      session.tick();
      expect(session.getState().cycle).toBe(1);
      session.tick();
      expect(session.getState().cycle).toBe(2);

      session.dispose();
    });

    it('multiple ticks advance state correctly', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      // Set input high
      session.setInput('d', true);

      // Tick several times — bit should propagate through shift register
      for (let i = 0; i < 5; i++) session.tick();

      const state = session.getState();
      expect(state.cycle).toBe(5);
      expect(state.history.length).toBe(6); // initial + 5 ticks

      session.dispose();
    });

    it('setInput + runCombinational updates portValues for combinational', () => {
      const engine = createAndGate();
      const session = new SimulationSession(engine, { isSequential: false });

      // Initially both inputs false → output should be false
      session.setInput('a', false);
      session.setInput('b', false);
      session.runCombinational();
      let pv = session.getState().portValues;
      // Find the AND output
      let outVal: boolean | number | undefined;
      for (const [key, val] of pv) {
        if (key.includes('and1') && key.endsWith('.out')) outVal = val;
      }
      expect(outVal).toBe(false);

      // Set both true → output should be true
      session.setInput('a', true);
      session.setInput('b', true);
      session.runCombinational();
      pv = session.getState().portValues;
      for (const [key, val] of pv) {
        if (key.includes('and1') && key.endsWith('.out')) outVal = val;
      }
      expect(outVal).toBe(true);

      session.dispose();
    });

    it('auto-run with onBeforeTick syncs inputs each tick', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      let inputValue = false;

      session.startAutoRun(10, {
        displayRate: 10,
        onBeforeTick: () => {
          session.setInput('d', inputValue);
        },
      });

      // Run with input off
      vi.advanceTimersByTime(100);
      const cycleA = session.getState().cycle;
      expect(cycleA).toBeGreaterThan(0);

      // Change input to on (simulates keyboard press)
      inputValue = true;
      vi.advanceTimersByTime(200);
      const cycleB = session.getState().cycle;
      expect(cycleB).toBeGreaterThan(cycleA);

      session.dispose();
    });

    it('time-travel then resume does not break auto-run', () => {
      vi.useFakeTimers();
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      // Tick a few times manually
      for (let i = 0; i < 5; i++) session.tick();
      expect(session.getState().cycle).toBe(5);

      // Step back
      session.stepBack();
      expect(session.getState().isViewingPast).toBe(true);
      expect(session.getState().cycle).toBe(4);

      // Start auto-run from past (should truncate forward history and resume)
      session.startAutoRun(10, { displayRate: 10 });
      vi.advanceTimersByTime(200);

      expect(session.getState().isRunning).toBe(true);
      expect(session.getState().cycle).toBeGreaterThan(4);
      expect(session.getState().isViewingPast).toBe(false);

      session.dispose();
    });

    it('subscribe receives updates for every tick in manual mode', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });
      const cycles: number[] = [];

      session.subscribe(() => {
        cycles.push(session.getState().cycle);
      });

      session.tick();
      session.tick();
      session.tick();

      expect(cycles).toEqual([1, 2, 3]);

      session.dispose();
    });

    it('getEngine returns the underlying engine', () => {
      const engine = createShiftRegister();
      const session = new SimulationSession(engine, { isSequential: true });

      expect(session.getEngine()).toBe(engine);

      session.dispose();
      expect(session.getEngine()).toBeNull();
    });

    it('creating a new session from same circuit type gives fresh state', () => {
      const engine1 = createShiftRegister();
      const session1 = new SimulationSession(engine1, { isSequential: true });
      session1.tick();
      session1.tick();
      expect(session1.getState().cycle).toBe(2);
      session1.dispose();

      // New session — should start at 0
      const engine2 = createShiftRegister();
      const session2 = new SimulationSession(engine2, { isSequential: true });
      expect(session2.getState().cycle).toBe(0);
      session2.dispose();
    });
  });
});
