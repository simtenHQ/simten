/**
 * Session-level time-travel for stateful display components.
 *
 * The editor's stepBack/stepForward reads circuit state back through
 * SimulationSession (which drives the engine's snapshot/restore). Registers
 * and wires are observed via port values; memory (RAM) and text (Console/UART)
 * are observed via the engine's *sequential state*.
 *
 * Regression: `getState()` (sequential state) and `getPortValues()` share one
 * `cacheValid` flag. `restore()` invalidated the flag but didn't clear the
 * cached sequential state, and the session's seekTo() calls getPortValues()
 * before getState() — so getPortValues() re-validated the flag and getState()
 * handed back the pre-restore (latest) state. Result: registers rewound under
 * time-travel but RAM framebuffers and console text did not. These tests drive
 * the real session path and assert both kinds of state rewind.
 */
import { describe, it, expect } from 'vitest';
import { circuit, bit, bus } from '../../circuit/index.js';
import { RAM, Console } from '../../std/index.js';
import { createSimulatorFromCircuit, SimulationSession } from '../index.js';
import { isSequentialCircuit } from '../../circuit/is-sequential.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import type { BuiltCircuit } from '../../circuit/index.js';

/** A RAM framebuffer plus a text Console — the two state shapes that broke. */
const Probe = circuit('TimeTravelProbe', {
  inputs: { addr: bus(8), data_in: bus(8), we: bit, ch: bus(8), ch_we: bit },
  outputs: { data_out: bus(8) },
  nodes: { ram: RAM(), con: Console },
  connect: ({ inputs, outputs, nodes: { ram, con } }) => [
    inputs.addr.to(ram.addr),
    inputs.data_in.to(ram.data_in),
    inputs.we.to(ram.we),
    ram.data_out.to(outputs.data_out),
    inputs.ch.to(con.data),
    inputs.ch_we.to(con.we),
  ],
});

function makeSession(built: BuiltCircuit<any, any>): SimulationSession {
  const circuitMap = new Map<string, Circuit>();
  const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  lib.addCircuit(built.circuit);
  if (built._dependencies) for (const [, dep] of built._dependencies) lib.addCircuit(dep.circuit);
  const isSeq = isSequentialCircuit(built.circuit, lib.resolveCircuit);
  const engine = createSimulatorFromCircuit(built.circuit, lib);
  engine.runCombinational();
  return new SimulationSession(engine, { isSequential: isSeq });
}

function ramFrame(session: SimulationSession): number[] {
  const seq = session.getState().sequentialState;
  let mem: Map<number, number> | null = null;
  for (const [, v] of seq?.currentState ?? []) {
    if (v instanceof Map) {
      mem = v as Map<number, number>;
      break;
    }
  }
  return Array.from({ length: 8 }, (_, i) => mem?.get(i) ?? 0);
}

function consoleText(session: SimulationSession): string {
  const seq = session.getState().sequentialState;
  for (const [, v] of seq?.currentState ?? []) {
    if (typeof v === 'string') return v;
  }
  return '';
}

describe('session time-travel — stateful display components', () => {
  it('stepBack/stepForward rewinds a RAM framebuffer and console text', () => {
    const session = makeSession(Probe);

    // Tick 8 times: write pixel i = i+1 to address i, and append char 'A'+i.
    const ramFrames: number[][] = [ramFrame(session)];
    const texts: string[] = [consoleText(session)];
    for (let i = 0; i < 8; i++) {
      session.setNode('addr', i);
      session.setNode('data_in', i + 1);
      session.setNode('we', true);
      session.setNode('ch', 65 + i); // 'A'..'H'
      session.setNode('ch_we', true);
      session.tick();
      ramFrames.push(ramFrame(session));
      texts.push(consoleText(session));
    }

    // Sanity: state actually accumulated.
    expect(ramFrames[8]).not.toEqual(ramFrames[3]);
    expect(texts[8]).toBe('ABCDEFGH');
    expect(session.getState().historyIndex).toBe(8);

    // Step back to frame 3 — both RAM and console must rewind.
    while (session.getState().historyIndex > 3) session.stepBack();
    expect(session.getState().historyIndex).toBe(3);
    expect(ramFrame(session)).toEqual(ramFrames[3]);
    expect(consoleText(session)).toBe('ABC');

    // Step forward — both advance again.
    session.stepForward();
    expect(ramFrame(session)).toEqual(ramFrames[4]);
    expect(consoleText(session)).toBe('ABCD');
  });

  it('seeking directly to an index rewinds sequential state', () => {
    const session = makeSession(Probe);
    const frames: number[][] = [ramFrame(session)];
    for (let i = 0; i < 6; i++) {
      session.setNode('addr', i);
      session.setNode('data_in', i + 10);
      session.setNode('we', true);
      session.tick();
      frames.push(ramFrame(session));
    }
    session.seek(2);
    expect(ramFrame(session)).toEqual(frames[2]);
    session.seek(5);
    expect(ramFrame(session)).toEqual(frames[5]);
  });
});
