import { useState, useEffect } from "react";
import { useCircuitSimulator } from "@turing-incomplete/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/canvas";
import { circuit, bus } from "@turing-incomplete/core/circuit";
import { Register, Adder, Constant, DFlipFlop, HexDisplay } from "@turing-incomplete/core/std";

// --- Live Fibonacci circuit (auto-ticking) ---

const Fibonacci = circuit('Fibonacci', {
  out: { fib: bus(8) },
  nodes: { reg_a: Register, reg_b: Register, adder: Adder, one_bit: Constant, init: DFlipFlop },
  nodeArgs: { one_bit: { value: 1 } },
  connect: ({ out, reg_a, reg_b, adder, one_bit, init }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, out.fib),
    adder.sum.to(reg_b.data),
  ],
});

const FibonacciDemo = circuit('FibonacciDemo', {
  nodes: { fib: Fibonacci, display: HexDisplay },
  connect: ({ fib, display }) => [
    fib.fib.to(display.in),
  ],
});

function LiveFibonacci() {
  const sim = useCircuitSimulator(FibonacciDemo);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!sim.ready || !running) return;
    const id = setInterval(() => sim.tick(), 800);
    return () => clearInterval(id);
  }, [sim.ready, running, sim.tick]);

  if (!sim.ready) {
    return (
      <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
        Compiling...
      </div>
    );
  }

  return (
    <div>
      <div className="h-[220px]">
        <CircuitCanvas
          circuit={sim.circuit}
        componentLibrary={sim.componentLibrary ?? undefined}
          portValues={sim.portValues}
          sequentialState={sim.sequentialState}
          onToggleNode={sim.toggleNode}
          theme="dark"
        />
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
        <button
          onClick={() => setRunning(!running)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            running
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {running ? "Pause" : "Run"}
        </button>
        <button
          onClick={() => {
            sim.reset();
            setRunning(true);
          }}
          className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
        >
          Reset
        </button>
        <span className="text-gray-600 text-xs ml-auto font-mono tabular-nums">
          Cycle {sim.cycleCount}
        </span>
      </div>
    </div>
  );
}

// --- Data ---

const SHOWCASE_ITEMS = [
  {
    title: "8-bit ALU",
    description:
      "ADD, SUB, AND, OR, XOR, NOT, SHL, SHR — selected by a 3-bit opcode. Zero, carry, and negative flags.",
    stats: "145 lines · 8 operations · 3 flags",
  },
  {
    title: "6502 CPU",
    description:
      "A working replica of the processor that powered the Apple II and NES. ALU, registers, instruction decode, memory bus.",
    stats: "3,000+ lines · 35 stages · full test suite",
  },
  {
    title: "Snake",
    description:
      "A complete game running on a simulated screen. No software, no ROM — pure hardware state machines driving an 8x8 display.",
    stats: "157 lines · raster display · keyboard input",
  },
];

const SPECS = [
  { value: "50+", label: "primitives" },
  { value: "Cycle-accurate", label: "simulation" },
  { value: "Testbench", label: "assertions" },
  { value: "Waveforms", label: "built in" },
];

// --- Main ---

export function ShowcaseSection() {
  return (
    <>
      {/* Live demo */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 max-w-xl">
              <div className="text-gray-500 text-xs font-medium mb-1.5 tracking-wide uppercase">
                Sequential logic
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
                Two registers, one adder, Fibonacci
              </h2>
              <p className="text-base text-gray-400 leading-relaxed mb-3">
                No software, no instructions. Two registers shift values through
                an adder every clock tick. The sequence emerges from the
                datapath.
              </p>
              <p className="text-sm text-gray-600">
                Running live in your browser.
              </p>
            </div>
            <div className="flex-1 w-full max-w-lg">
              <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
                <LiveFibonacci />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="py-8 px-6 border-y border-gray-800/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {SPECS.map((spec) => (
            <div key={spec.label} className="text-center">
              <div className="text-xl md:text-2xl font-bold text-white">
                {spec.value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{spec.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              What people have built
            </h2>
            <p className="text-gray-500 text-sm">
              Same simulator, same DSL. From logic gates to a working processor.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {SHOWCASE_ITEMS.map((item) => (
              <div
                key={item.title}
                className="bg-gray-900/40 rounded-lg border border-gray-800 p-5"
              >
                <h3 className="text-base font-semibold mb-1.5">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">
                  {item.description}
                </p>
                <div className="text-xs text-gray-600 font-mono">
                  {item.stats}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
