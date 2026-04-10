/**
 * TypeScript Playground — demonstrates the new circuit() API
 * with live simulation running entirely in React, no canvas needed.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { circuit, bit, bus, executeCircuitCode } from "@turing-incomplete/core/circuit";
import { simulate, type SimulationHandle } from "@turing-incomplete/core/sim";
import { And, Xor, Or, Not, DFlipFlop, Register, Constant, Mux } from "@turing-incomplete/core/std";

export const Route = createFileRoute("/demos/playground")({
  component: PlaygroundPage,
});

// ============================================================================
// Live circuits defined right here in TypeScript
// ============================================================================

// 4-bit counter with enable and reset
const Counter4 = circuit('Counter4', {
  in: { enable: bit, reset: bit },
  out: { count: bus(4), zero: bit, max: bit },
  state: { value: 0 },
  eval: ({ value }) => ({
    count: (value as number) & 0xF,
    zero: (value as number) === 0 ? 1 : 0,
    max: (value as number) === 15 ? 1 : 0,
  }),
  onTick: ({ enable, reset, value }) => ({
    value: reset ? 0 : enable ? ((value as number) + 1) & 0xF : (value as number),
  }),
});

// Fibonacci generator
const Fibonacci = circuit('Fibonacci', {
  out: { value: bus(16), step: bus(8) },
  state: { a: 0, b: 1, n: 0 },
  eval: ({ a }) => ({ value: a as number, step: 0 }),
  onTick: ({ a, b, n }) => ({
    a: b as number,
    b: ((a as number) + (b as number)) & 0xFFFF,
    n: ((n as number) + 1) & 0xFF,
  }),
});

// Shift register — watch bits ripple through
const ShiftReg8 = circuit('ShiftReg8', {
  in: { data: bit },
  out: { b0: bit, b1: bit, b2: bit, b3: bit, b4: bit, b5: bit, b6: bit, b7: bit },
  state: { reg: 0 },
  eval: ({ reg }) => ({
    b0: ((reg as number) >> 0) & 1,
    b1: ((reg as number) >> 1) & 1,
    b2: ((reg as number) >> 2) & 1,
    b3: ((reg as number) >> 3) & 1,
    b4: ((reg as number) >> 4) & 1,
    b5: ((reg as number) >> 5) & 1,
    b6: ((reg as number) >> 6) & 1,
    b7: ((reg as number) >> 7) & 1,
  }),
  onTick: ({ data, reg }) => ({
    reg: (((reg as number) << 1) | (data ? 1 : 0)) & 0xFF,
  }),
});

// Custom user-defined eval: ReLU activation function
const ReLU = circuit('ReLU', {
  in: { x: bus(16) },
  out: { y: bus(16) },
  eval: ({ x }) => ({ y: x > 32767 ? 0 : x }), // Treat >32767 as negative
});

// ============================================================================
// React components — pure simulation, no canvas
// ============================================================================

function CounterDemo() {
  const sim = useMemo(() => simulate(Counter4), []);
  const [state, setState] = useState({ count: 0, zero: 1, max: 0, cycle: 0 });
  const [enabled, setEnabled] = useState(true);

  const tick = useCallback(() => {
    sim.set({ enable: enabled ? 1 : 0, reset: 0 });
    sim.tick();
    setState({
      count: sim.get('count'),
      zero: sim.get('zero'),
      max: sim.get('max'),
      cycle: sim.cycle,
    });
  }, [sim, enabled]);

  const reset = useCallback(() => {
    sim.set({ enable: 0, reset: 1 });
    sim.tick();
    sim.set({ reset: 0 });
    setState({ count: 0, zero: 1, max: 0, cycle: sim.cycle });
  }, [sim]);

  // Auto-tick
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [running, tick]);

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">4-Bit Counter</h3>
      <div className="flex items-center gap-4 mb-3">
        <div className="font-mono text-4xl tabular-nums font-bold text-foreground">
          {state.count.toString(2).padStart(4, '0')}
        </div>
        <div className="text-2xl font-mono text-muted-foreground">
          = {state.count}
        </div>
      </div>
      <div className="flex gap-1 mb-3">
        {[3, 2, 1, 0].map(i => (
          <div
            key={i}
            className={`w-8 h-8 rounded ${(state.count >> i) & 1 ? 'bg-green-500' : 'bg-muted'} transition-colors`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <span>Cycle {state.cycle}</span>
        {state.zero ? <span className="text-yellow-500">ZERO</span> : null}
        {state.max ? <span className="text-red-500">MAX</span> : null}
      </div>
      <div className="flex gap-2">
        <button onClick={tick} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs">Tick</button>
        <button onClick={() => setRunning(!running)} className={`px-3 py-1.5 rounded text-xs ${running ? 'bg-amber-600 text-white' : 'bg-muted text-foreground'}`}>
          {running ? 'Stop' : 'Run'}
        </button>
        <button onClick={reset} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Reset</button>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Enable
        </label>
      </div>
    </div>
  );
}

function FibonacciDemo() {
  const sim = useMemo(() => simulate(Fibonacci), []);
  const [values, setValues] = useState<number[]>([0]);

  const tick = useCallback(() => {
    sim.tick();
    setValues(prev => [...prev.slice(-20), sim.get('value')]);
  }, [sim]);

  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [running, tick]);

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Fibonacci Generator</h3>
      <div className="flex gap-1 h-24 items-end mb-3">
        {values.map((v, i) => (
          <div
            key={i}
            className="bg-blue-500 rounded-t min-w-[8px] flex-1 transition-all"
            style={{ height: `${Math.min(100, (v / 65535) * 100)}%`, minHeight: 2 }}
            title={v.toString()}
          />
        ))}
      </div>
      <div className="font-mono text-sm text-muted-foreground mb-3">
        Latest: {values[values.length - 1]} (0x{values[values.length - 1]?.toString(16).padStart(4, '0')})
      </div>
      <div className="flex gap-2">
        <button onClick={tick} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs">Tick</button>
        <button onClick={() => setRunning(!running)} className={`px-3 py-1.5 rounded text-xs ${running ? 'bg-amber-600 text-white' : 'bg-muted text-foreground'}`}>
          {running ? 'Stop' : 'Run'}
        </button>
        <button onClick={() => { sim.reset(); sim.tick(); setValues([0]); }} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Reset</button>
      </div>
    </div>
  );
}

function ShiftRegisterDemo() {
  const sim = useMemo(() => simulate(ShiftReg8), []);
  const [bits, setBits] = useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const [input, setInput] = useState(false);

  const tick = useCallback(() => {
    sim.set({ data: input ? 1 : 0 });
    sim.tick();
    setBits([
      sim.get('b7'), sim.get('b6'), sim.get('b5'), sim.get('b4'),
      sim.get('b3'), sim.get('b2'), sim.get('b1'), sim.get('b0'),
    ]);
  }, [sim, input]);

  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [running, tick]);

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">8-Bit Shift Register</h3>
      <div className="flex gap-1 mb-3">
        {bits.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-10 h-10 rounded ${b ? 'bg-emerald-500' : 'bg-muted'} transition-colors flex items-center justify-center text-xs font-mono`}>
              {b}
            </div>
            <span className="text-[10px] text-muted-foreground">b{7 - i}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <button onClick={() => { setInput(!input); }} className={`px-3 py-1.5 rounded text-xs font-mono ${input ? 'bg-emerald-600 text-white' : 'bg-muted text-foreground'}`}>
          IN: {input ? '1' : '0'}
        </button>
        <button onClick={tick} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs">Shift →</button>
        <button onClick={() => setRunning(!running)} className={`px-3 py-1.5 rounded text-xs ${running ? 'bg-amber-600 text-white' : 'bg-muted text-foreground'}`}>
          {running ? 'Stop' : 'Auto'}
        </button>
        <button onClick={() => { sim.reset(); sim.tick(); setBits([0,0,0,0,0,0,0,0]); }} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Clear</button>
      </div>
    </div>
  );
}

function LiveCodeDemo() {
  const [code, setCode] = useState(`const MyGate = circuit('MyGate', {
  in: { a: bit, b: bit },
  out: { and_out: bit, or_out: bit, xor_out: bit },
  nodes: { g_and: And, g_or: Or, g_xor: Xor },
  connect: ({ in: inp, out, g_and, g_or, g_xor }) => [
    inp.a.to(g_and.a, g_or.a, g_xor.a),
    inp.b.to(g_and.b, g_or.b, g_xor.b),
    g_and.out.to(out.and_out),
    g_or.out.to(out.or_out),
    g_xor.out.to(out.xor_out),
  ],
})`);
  const [result, setResult] = useState<{ outputs: Record<string, number>; error?: string } | null>(null);
  const [inputA, setInputA] = useState(0);
  const [inputB, setInputB] = useState(0);

  const run = useCallback(() => {
    const execResult = executeCircuitCode(code);
    if (execResult.error) {
      setResult({ outputs: {}, error: execResult.error });
      return;
    }
    if (!execResult.circuit) {
      setResult({ outputs: {}, error: 'No circuit found' });
      return;
    }
    const sim = simulate(execResult.builtCircuits[execResult.builtCircuits.length - 1]);
    sim.set({ a: inputA, b: inputB });
    const outputs: Record<string, number> = {};
    for (const port of execResult.circuit.outputs) {
      outputs[port.name] = sim.get(port.name as any);
    }
    setResult({ outputs });
    sim.dispose();
  }, [code, inputA, inputB]);

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Live Code → Simulate</h3>
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        className="w-full h-40 font-mono text-xs bg-muted rounded p-2 mb-3 resize-none"
        spellCheck={false}
      />
      <div className="flex gap-2 items-center mb-3">
        <label className="flex items-center gap-1 text-xs">
          a: <button onClick={() => setInputA(inputA ? 0 : 1)} className={`px-2 py-1 rounded font-mono ${inputA ? 'bg-emerald-600 text-white' : 'bg-muted'}`}>{inputA}</button>
        </label>
        <label className="flex items-center gap-1 text-xs">
          b: <button onClick={() => setInputB(inputB ? 0 : 1)} className={`px-2 py-1 rounded font-mono ${inputB ? 'bg-emerald-600 text-white' : 'bg-muted'}`}>{inputB}</button>
        </label>
        <button onClick={run} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs">Run</button>
      </div>
      {result && (
        <div className={`text-xs font-mono p-2 rounded ${result.error ? 'bg-red-500/10 text-red-400' : 'bg-muted'}`}>
          {result.error ? result.error : Object.entries(result.outputs).map(([k, v]) => `${k}: ${v}`).join('  |  ')}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">TypeScript Playground</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Hardware components defined in TypeScript, simulated in React. No canvas — just data.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <CounterDemo />
          <FibonacciDemo />
        </div>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <ShiftRegisterDemo />
          <LiveCodeDemo />
        </div>

        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <h2 className="text-sm font-semibold mb-2">How it works</h2>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`// Define a component in TypeScript
const Counter = circuit('Counter', {
  in: { enable: bit },
  out: { count: bus(4) },
  state: { value: 0 },
  eval: ({ value }) => ({ count: value & 0xF }),
  onTick: ({ enable, value }) => ({
    value: enable ? (value + 1) & 0xF : value,
  }),
})

// Simulate it — no canvas, no editor, just TypeScript
const sim = simulate(Counter)
sim.set({ enable: 1 })
sim.tick()
sim.get('count') // → 1`}</pre>
        </div>
      </div>
    </div>
  );
}
