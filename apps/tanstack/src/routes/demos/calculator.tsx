/**
 * Demo: Hardware Calculator
 *
 * Every operation is a circuit. You see the bits move.
 * The seven-segment display IS the answer.
 * The registers ARE the memory.
 * The ALU IS the computation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { circuit, bit, bus } from "@turing-incomplete/core/circuit";
import { simulate } from "@turing-incomplete/core/sim";

export const Route = createFileRoute("/demos/calculator")({
  component: CalculatorPage,
});

// ============================================================================
// The calculator circuit
// ============================================================================

const ALU_ADD = 0;
const ALU_SUB = 1;
const ALU_MUL = 2;
const ALU_AND = 3;
const ALU_OR  = 4;
const ALU_XOR = 5;
const ALU_SHL = 6;
const ALU_SHR = 7;

const Calculator = circuit('Calculator', {
  in: {
    load_a: bit,       // load input into register A
    load_b: bit,       // load input into register B
    compute: bit,      // trigger ALU computation
    clear: bit,        // reset everything
    data_in: bus(16),  // input data
    alu_op: bus(4),    // ALU operation select
  },
  out: {
    reg_a: bus(16),
    reg_b: bus(16),
    result: bus(16),
    carry: bit,
    zero: bit,
    overflow: bit,
    alu_active: bit,
  },
  state: { a: 0, b: 0, res: 0, flags: 0 },
  eval: ({ a, b, res, flags }) => ({
    reg_a: a as number,
    reg_b: b as number,
    result: res as number,
    carry: ((flags as number) >> 0) & 1,
    zero: ((flags as number) >> 1) & 1,
    overflow: ((flags as number) >> 2) & 1,
    alu_active: 0,
  }),
  onTick: ({ load_a, load_b, compute, clear, data_in, alu_op, a, b, res, flags }) => {
    if (clear) return { a: 0, b: 0, res: 0, flags: 0 };

    let na = a as number;
    let nb = b as number;
    let nr = res as number;
    let nf = 0;

    if (load_a) na = data_in as number;
    if (load_b) nb = data_in as number;

    if (compute) {
      switch (alu_op as number) {
        case ALU_ADD: nr = na + nb; break;
        case ALU_SUB: nr = na - nb; break;
        case ALU_MUL: nr = na * nb; break;
        case ALU_AND: nr = na & nb; break;
        case ALU_OR:  nr = na | nb; break;
        case ALU_XOR: nr = na ^ nb; break;
        case ALU_SHL: nr = na << (nb & 0xF); break;
        case ALU_SHR: nr = na >>> (nb & 0xF); break;
      }
      // Flags
      nf = 0;
      if (nr > 0xFFFF) nf |= 1;  // carry
      if ((nr & 0xFFFF) === 0) nf |= 2;  // zero
      if (nr > 0x7FFF || nr < -0x8000) nf |= 4;  // overflow
      nr = nr & 0xFFFF;
    }

    return { a: na, b: nb, res: nr, flags: nf };
  },
});

// ============================================================================
// Visualization helpers
// ============================================================================

function Bits({ value, width, label, highlight }: { value: number; width: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? 'border-amber-500 bg-amber-500/5' : 'border-border'} transition-colors`}>
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-px">
        {Array.from({ length: width }, (_, i) => {
          const bitIdx = width - 1 - i;
          const on = (value >> bitIdx) & 1;
          return (
            <div key={i} className={`w-3.5 h-5 rounded-sm text-[9px] flex items-center justify-center font-mono transition-colors ${on ? 'bg-emerald-500 text-white' : 'bg-muted/50 text-muted-foreground/30'}`}>
              {on}
            </div>
          );
        })}
      </div>
      <div className="text-xs font-mono mt-1 text-center">{value}</div>
    </div>
  );
}

function SevenSeg({ value }: { value: number }) {
  // Display up to 4 hex digits
  const digits = [
    (value >> 12) & 0xF,
    (value >> 8) & 0xF,
    (value >> 4) & 0xF,
    value & 0xF,
  ];

  const segments: Record<number, boolean[]> = {
    //                  a     b     c     d     e     f     g
    0x0: [true,  true,  true,  true,  true,  true,  false],
    0x1: [false, true,  true,  false, false, false, false],
    0x2: [true,  true,  false, true,  true,  false, true],
    0x3: [true,  true,  true,  true,  false, false, true],
    0x4: [false, true,  true,  false, false, true,  true],
    0x5: [true,  false, true,  true,  false, true,  true],
    0x6: [true,  false, true,  true,  true,  true,  true],
    0x7: [true,  true,  true,  false, false, false, false],
    0x8: [true,  true,  true,  true,  true,  true,  true],
    0x9: [true,  true,  true,  true,  false, true,  true],
    0xA: [true,  true,  true,  false, true,  true,  true],
    0xB: [false, false, true,  true,  true,  true,  true],
    0xC: [true,  false, false, true,  true,  true,  false],
    0xD: [false, true,  true,  true,  true,  false, true],
    0xE: [true,  false, false, true,  true,  true,  true],
    0xF: [true,  false, false, false, true,  true,  true],
  };

  return (
    <div className="flex gap-2">
      {digits.map((d, i) => {
        const s = segments[d] ?? segments[0];
        const on = "bg-red-500";
        const off = "bg-red-500/10";
        const w = 24;
        const h = 40;
        return (
          <svg key={i} width={w + 8} height={h + 8} viewBox={`0 0 ${w + 8} ${h + 8}`}>
            {/* a - top */}
            <rect x={6} y={2} width={w - 4} height={3} rx={1} className={s[0] ? on : off} fill="currentColor" />
            {/* b - top right */}
            <rect x={w + 1} y={6} width={3} height={h / 2 - 4} rx={1} className={s[1] ? on : off} fill="currentColor" />
            {/* c - bottom right */}
            <rect x={w + 1} y={h / 2 + 4} width={3} height={h / 2 - 4} rx={1} className={s[2] ? on : off} fill="currentColor" />
            {/* d - bottom */}
            <rect x={6} y={h + 2} width={w - 4} height={3} rx={1} className={s[3] ? on : off} fill="currentColor" />
            {/* e - bottom left */}
            <rect x={2} y={h / 2 + 4} width={3} height={h / 2 - 4} rx={1} className={s[4] ? on : off} fill="currentColor" />
            {/* f - top left */}
            <rect x={2} y={6} width={3} height={h / 2 - 4} rx={1} className={s[5] ? on : off} fill="currentColor" />
            {/* g - middle */}
            <rect x={6} y={h / 2 + 1} width={w - 4} height={3} rx={1} className={s[6] ? on : off} fill="currentColor" />
          </svg>
        );
      })}
    </div>
  );
}

function Flag({ name, active }: { name: string; active: boolean }) {
  return (
    <div className={`px-2 py-1 rounded text-[10px] font-mono ${active ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-muted/30 text-muted-foreground/30'}`}>
      {name}
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

const OP_NAMES: Record<number, string> = {
  [ALU_ADD]: '+', [ALU_SUB]: '−', [ALU_MUL]: '×',
  [ALU_AND]: 'AND', [ALU_OR]: 'OR', [ALU_XOR]: 'XOR',
  [ALU_SHL]: '≪', [ALU_SHR]: '≫',
};

function CalculatorPage() {
  const sim = useMemo(() => simulate(Calculator), []);
  const [state, setState] = useState(sim.read());
  const [inputValue, setInputValue] = useState(0);
  const [selectedOp, setSelectedOp] = useState(ALU_ADD);
  const [lastAction, setLastAction] = useState('');
  const [cycle, setCycle] = useState(0);
  const [activeRegister, setActiveRegister] = useState<string | null>(null);

  const tick = useCallback((inputs: Record<string, number>, label: string) => {
    sim.set(inputs);
    sim.tick();
    setState(sim.read());
    setCycle(sim.cycle);
    setLastAction(label);
    setActiveRegister(inputs.load_a ? 'a' : inputs.load_b ? 'b' : inputs.compute ? 'result' : null);
    setTimeout(() => setActiveRegister(null), 400);
  }, [sim]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Hardware Calculator</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Every operation is a clock tick. Every bit is visible. The circuit IS the calculator.
        </p>

        {/* Seven-segment result display */}
        <div className="flex justify-center mb-6 py-6 bg-gray-950 rounded-xl border border-border">
          <div className="text-red-500">
            <SevenSeg value={state.result} />
            <div className="text-center text-xs font-mono text-red-500/50 mt-2">
              0x{state.result.toString(16).toUpperCase().padStart(4, '0')}
            </div>
          </div>
        </div>

        {/* Register file — visible bits */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Bits value={state.reg_a} width={16} label="Register A" highlight={activeRegister === 'a'} />
          <Bits value={state.reg_b} width={16} label="Register B" highlight={activeRegister === 'b'} />
          <Bits value={state.result} width={16} label="ALU Result" highlight={activeRegister === 'result'} />
        </div>

        {/* Status flags */}
        <div className="flex gap-2 mb-6 justify-center">
          <Flag name="CARRY" active={!!state.carry} />
          <Flag name="ZERO" active={!!state.zero} />
          <Flag name="OVERFLOW" active={!!state.overflow} />
          <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground/50">
            Cycle {cycle}
          </div>
        </div>

        {/* Input controls */}
        <div className="border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-xs text-muted-foreground">Input value:</label>
            <input
              type="number"
              min={0}
              max={65535}
              value={inputValue}
              onChange={e => setInputValue(Math.max(0, Math.min(65535, parseInt(e.target.value) || 0)))}
              className="w-24 bg-muted rounded px-2 py-1.5 font-mono text-sm text-center"
            />
            <span className="text-xs text-muted-foreground font-mono">
              (0x{inputValue.toString(16).toUpperCase().padStart(4, '0')})
            </span>
          </div>

          {/* Load buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => tick({ load_a: 1, load_b: 0, compute: 0, clear: 0, data_in: inputValue, alu_op: selectedOp }, `Load ${inputValue} → A`)}
              className="flex-1 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded text-sm font-mono hover:bg-blue-600/30 transition-colors"
            >
              → Load A
            </button>
            <button
              onClick={() => tick({ load_a: 0, load_b: 1, compute: 0, clear: 0, data_in: inputValue, alu_op: selectedOp }, `Load ${inputValue} → B`)}
              className="flex-1 py-2 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded text-sm font-mono hover:bg-purple-600/30 transition-colors"
            >
              → Load B
            </button>
          </div>

          {/* ALU operation buttons */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {Object.entries(OP_NAMES).map(([op, label]) => (
              <button
                key={op}
                onClick={() => setSelectedOp(Number(op))}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                  selectedOp === Number(op)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Compute */}
          <div className="flex gap-2">
            <button
              onClick={() => tick({ load_a: 0, load_b: 0, compute: 1, clear: 0, data_in: 0, alu_op: selectedOp }, `Compute: A ${OP_NAMES[selectedOp]} B`)}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              = Compute (A {OP_NAMES[selectedOp]} B)
            </button>
            <button
              onClick={() => tick({ load_a: 0, load_b: 0, compute: 0, clear: 1, data_in: 0, alu_op: 0 }, 'Clear')}
              className="px-4 py-2.5 bg-red-600/20 text-red-400 border border-red-600/30 rounded text-sm hover:bg-red-600/30 transition-colors"
            >
              CLR
            </button>
          </div>
        </div>

        {/* Action log */}
        {lastAction && (
          <div className="text-xs font-mono text-muted-foreground text-center mb-4">
            Last tick: {lastAction}
          </div>
        )}

        {/* Quick examples */}
        <div className="border border-border rounded-lg p-4 mb-4">
          <div className="text-xs text-muted-foreground mb-2">Try it:</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setInputValue(42);
                tick({ load_a: 1, load_b: 0, compute: 0, clear: 0, data_in: 42, alu_op: ALU_ADD }, 'Load 42 → A');
                setTimeout(() => {
                  setInputValue(13);
                  tick({ load_a: 0, load_b: 1, compute: 0, clear: 0, data_in: 13, alu_op: ALU_ADD }, 'Load 13 → B');
                  setTimeout(() => {
                    setSelectedOp(ALU_ADD);
                    tick({ load_a: 0, load_b: 0, compute: 1, clear: 0, data_in: 0, alu_op: ALU_ADD }, 'Compute: A + B');
                  }, 300);
                }, 300);
              }}
              className="px-3 py-1.5 bg-muted text-foreground rounded text-xs"
            >
              42 + 13 = 55
            </button>
            <button
              onClick={() => {
                tick({ load_a: 1, load_b: 0, compute: 0, clear: 0, data_in: 0xFF, alu_op: ALU_ADD }, 'Load 0xFF → A');
                setTimeout(() => {
                  tick({ load_a: 0, load_b: 1, compute: 0, clear: 0, data_in: 1, alu_op: ALU_ADD }, 'Load 1 → B');
                  setTimeout(() => {
                    setSelectedOp(ALU_ADD);
                    tick({ load_a: 0, load_b: 0, compute: 1, clear: 0, data_in: 0, alu_op: ALU_ADD }, 'Compute: 255 + 1 (overflow!)');
                  }, 300);
                }, 300);
              }}
              className="px-3 py-1.5 bg-muted text-foreground rounded text-xs"
            >
              255 + 1 (overflow)
            </button>
            <button
              onClick={() => {
                tick({ load_a: 1, load_b: 0, compute: 0, clear: 0, data_in: 0b10101010, alu_op: ALU_XOR }, 'Load 0xAA → A');
                setTimeout(() => {
                  tick({ load_a: 0, load_b: 1, compute: 0, clear: 0, data_in: 0b11110000, alu_op: ALU_XOR }, 'Load 0xF0 → B');
                  setTimeout(() => {
                    setSelectedOp(ALU_XOR);
                    tick({ load_a: 0, load_b: 0, compute: 1, clear: 0, data_in: 0, alu_op: ALU_XOR }, 'XOR: watch the bits flip');
                  }, 300);
                }, 300);
              }}
              className="px-3 py-1.5 bg-muted text-foreground rounded text-xs"
            >
              0xAA XOR 0xF0 (watch bits)
            </button>
          </div>
        </div>

        {/* Circuit info */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <h2 className="text-sm font-semibold mb-2">This is a circuit</h2>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`const Calculator = circuit('Calculator', {
  in: { load_a: bit, load_b: bit, compute: bit, data_in: bus(16), alu_op: bus(4) },
  out: { reg_a: bus(16), reg_b: bus(16), result: bus(16), carry: bit, zero: bit },
  state: { a: 0, b: 0, res: 0, flags: 0 },
  // eval: outputs from current state (combinational)
  // onTick: state transitions on clock edge (sequential)
})

// Every button press = sim.set(inputs) → sim.tick() → sim.read()
// The seven-segment display reads from the result register
// The bit displays show actual register contents
// The flags come from the ALU's comparators`}</pre>
        </div>
      </div>
    </div>
  );
}
