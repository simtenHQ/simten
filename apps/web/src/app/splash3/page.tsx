"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";
import { CIRCUITS, CIRCUIT_KEYS } from "./circuits";

type CircuitKey = (typeof CIRCUIT_KEYS)[number];

// Interactive circuit demo component
function CircuitDemo({ circuitKey }: { circuitKey: CircuitKey }) {
  const circuitDef = CIRCUITS[circuitKey];
  // Simulate the full DSL (includes wrapper circuit with Switch/LED nodes)
  const sim = useCircuitSimulator(circuitDef.dsl);

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
      className="flex flex-col md:flex-row gap-4 md:h-[400px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Circuit Canvas - shows first on mobile (top) */}
      <div className="flex flex-col order-1 md:order-2 md:flex-1">
        <div className="text-xs text-gray-500 mb-2">CIRCUIT</div>
        <div className="h-[250px] md:h-[370px]">
          <CircuitCanvas
            circuit={sim.circuit}
            portValues={sim.portValues}
            sequentialState={sim.sequentialState}
            onToggleNode={sim.toggleNode}
            drillDown={false}
          />
        </div>
      </div>

      {/* DSL Code - shows second on mobile (bottom) */}
      <div className="md:w-1/3 flex flex-col order-2 md:order-1">
        <div className="text-xs text-gray-500 mb-2">DSL CODE</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/" className="flex-1 block">
                <pre className="h-full max-h-[200px] md:max-h-none p-3 bg-gray-950 rounded-lg text-xs font-mono text-gray-400 overflow-auto border border-gray-800 hover:border-green-500/50 transition-colors cursor-pointer">
                  {circuitDef.displayDsl.trim()}
                </pre>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Want to edit? Open in full editor</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
    </motion.div>
  );
}

export default function Splash3Page() {
  const [activeCircuit, setActiveCircuit] = useState<CircuitKey>("inverter");

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
              const idx = CIRCUIT_KEYS.indexOf(activeCircuit);
              const prev = idx === 0 ? CIRCUIT_KEYS.length - 1 : idx - 1;
              setActiveCircuit(CIRCUIT_KEYS[prev]);
            }}
            className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
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
                      ({CIRCUIT_KEYS.indexOf(activeCircuit) + 1}/
                      {CIRCUIT_KEYS.length})
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
              const idx = CIRCUIT_KEYS.indexOf(activeCircuit);
              const next = idx === CIRCUIT_KEYS.length - 1 ? 0 : idx + 1;
              setActiveCircuit(CIRCUIT_KEYS[next]);
            }}
            className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
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
