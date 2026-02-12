"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useCircuitSimulator } from "../splash2/useCircuitSimulator";
import { MiniCanvas } from "./MiniCanvas";

// Pure DSL templates - the simulator figures out inputs/outputs automatically!
const CIRCUITS = {
  inverter: {
    name: "NOT Gate",
    description: "Inverts the input signal",
    dsl: `
circuit Not {
  input a: Bit
  output out: Bit
  impl {
    node nand1: Nand
    connect a -> nand1.a
    connect a -> nand1.b
    connect nand1.out -> out
  }
}`,
  },
  and: {
    name: "AND Gate",
    description: "Output is 1 only when both inputs are 1",
    dsl: `
circuit And {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> out
  }
}`,
  },
  or: {
    name: "OR Gate",
    description: "Output is 1 when either input is 1",
    dsl: `
circuit Or {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand
    connect a -> not_a.a
    connect a -> not_a.b
    connect b -> not_b.a
    connect b -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out
  }
}`,
  },
  xor: {
    name: "XOR Gate",
    description: "Output is 1 when inputs are different",
    dsl: `
circuit Xor {
  input a: Bit
  input b: Bit
  output out: Bit
  impl {
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect a -> nand2.a
    connect nand1.out -> nand2.b
    connect nand1.out -> nand3.a
    connect b -> nand3.b
    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b
    connect nand4.out -> out
  }
}`,
  },
  halfAdder: {
    name: "Half Adder",
    description: "Adds two bits, outputs sum and carry",
    dsl: `
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}`,
  },
  fullAdder: {
    name: "Full Adder",
    description: "Adds three bits (a, b, carry-in)",
    dsl: `
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}`,
  },
  mux: {
    name: "Multiplexer",
    description: "sel=0 picks a, sel=1 picks b",
    dsl: `
circuit Mux {
  input a: Bit
  input b: Bit
  input sel: Bit
  output out: Bit
  impl {
    node not_sel: Not
    node and_a: And
    node and_b: And
    node or_out: Or
    connect sel -> not_sel.in
    connect a -> and_a.a
    connect not_sel.out -> and_a.b
    connect b -> and_b.a
    connect sel -> and_b.b
    connect and_a.out -> or_out.a
    connect and_b.out -> or_out.b
    connect or_out.out -> out
  }
}`,
  },
  delayLine: {
    name: "2-Cycle Delay",
    description: "Data takes 2 clock ticks to reach output",
    dsl: `
circuit DelayLine {
  input d: Bit
  clock clk
  output q1: Bit
  output q2: Bit
  impl {
    node dff1: DFlipFlop
    node dff2: DFlipFlop
    connect clk -> dff1.clk
    connect clk -> dff2.clk
    connect d -> dff1.d
    connect dff1.q -> dff2.d
    connect dff1.q -> q1
    connect dff2.q -> q2
  }
}`,
  },
};

type CircuitKey = keyof typeof CIRCUITS;

// Interactive circuit demo component
function CircuitDemo({ circuitKey }: { circuitKey: CircuitKey }) {
  const circuit = CIRCUITS[circuitKey];
  const sim = useCircuitSimulator(circuit.dsl);

  if (sim.error) {
    return (
      <div className="p-4 bg-red-900/50 rounded-lg border border-red-500">
        <div className="text-red-400 text-sm font-mono">{sim.error}</div>
      </div>
    );
  }

  if (!sim.ready) {
    return (
      <div className="flex gap-4 h-[400px] items-center justify-center">
        <div className="text-gray-500">Compiling...</div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex gap-4 h-[400px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Left side: DSL Code */}
      <div className="w-1/3 flex flex-col">
        <div className="text-xs text-gray-500 mb-2">DSL CODE</div>
        <pre className="flex-1 p-3 bg-gray-950 rounded-lg text-xs font-mono text-gray-400 overflow-auto border border-gray-800">
          {circuit.dsl.trim()}
        </pre>

        {/* Clock controls for sequential circuits */}
        {sim.isSequential && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={sim.tick}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Tick
              </button>
              <button
                onClick={sim.reset}
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Reset
              </button>
              <span className="text-gray-500 text-xs">
                Cycle: {sim.cycleCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Circuit Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="text-xs text-gray-500 mb-2">CIRCUIT</div>
        <div className="flex-1">
          <MiniCanvas
            circuit={sim.circuit}
            portValues={sim.portValues}
            sequentialState={sim.sequentialState}
            inputValues={sim.inputs}
            onToggleInput={sim.toggleInput}
            height={370}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function Splash3Page() {
  const [activeCircuit, setActiveCircuit] = useState<CircuitKey>("inverter");

  const allCircuits: CircuitKey[] = [
    "inverter", "and", "or", "xor",
    "halfAdder", "fullAdder", "mux",
    "delayLine"
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Turing Incomplete</div>
          <Link
            href="/"
            className="px-4 py-1.5 bg-green-500 text-black rounded-lg text-sm font-medium hover:bg-green-400"
          >
            Open Editor
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Real Simulator. Real Circuits.
          </h1>
          <p className="text-gray-400">
            This is the actual simulator running your DSL code — not a mock.
            <br />
            Toggle inputs, watch outputs change, see sequential circuits tick.
          </p>
        </div>
      </section>

      {/* Active circuit demo with carousel arrows */}
      <section className="px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          {/* Left arrow */}
          <button
            onClick={() => {
              const idx = allCircuits.indexOf(activeCircuit);
              const prev = idx === 0 ? allCircuits.length - 1 : idx - 1;
              setActiveCircuit(allCircuits[prev]);
            }}
            className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Card */}
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCircuit}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-3">
                  <h2 className="text-lg font-semibold">
                    {CIRCUITS[activeCircuit].name}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {CIRCUITS[activeCircuit].description}
                    <span className="text-gray-600 ml-2">
                      ({allCircuits.indexOf(activeCircuit) + 1}/{allCircuits.length})
                    </span>
                  </p>
                </div>

                <CircuitDemo circuitKey={activeCircuit} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right arrow */}
          <button
            onClick={() => {
              const idx = allCircuits.indexOf(activeCircuit);
              const next = idx === allCircuits.length - 1 ? 0 : idx + 1;
              setActiveCircuit(allCircuits[next]);
            }}
            className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-400 mb-4">
            Every circuit above is compiled and simulated in real-time.
            <br />
            The same engine powers the full editor.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-green-500 text-black rounded-lg font-semibold hover:bg-green-400"
          >
            Build Your Own
          </Link>
        </div>
      </section>
    </div>
  );
}
