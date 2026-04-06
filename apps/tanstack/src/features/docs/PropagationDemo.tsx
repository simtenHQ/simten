"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCircuitSimulator } from "@turing-incomplete/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/canvas";
import { executeCircuitCode } from "@turing-incomplete/core";
import type { Circuit } from "@turing-incomplete/core";
import {
  elaborate,
  tracePropagation,
  PRIMITIVE_DEFINITIONS,
  generatePrimitives,
  type PropagationStep,
} from "@turing-incomplete/core/simulator";

const DEMO_DSL = `
const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})

const HalfAdderDemo = circuit('HalfAdderDemo', {
  nodes: { sw_a: Switch, sw_b: Switch, dut: HalfAdder, led_sum: Led, led_carry: Led },
  connect: ({ in: inp, out, sw_a, sw_b, dut, led_sum, led_carry }) => [
    sw_a.out.to(dut.a),
    sw_b.out.to(dut.b),
    dut.sum.to(led_sum.in),
    dut.carry.to(led_carry.in),
  ],
})
`;

/**
 * Extract a clean label from a mangled node ID.
 * "HalfAdderDemo_sw_a_1234_abcd" → "sw_a"
 * "HalfAdderDemo_dut_1234_abcd.HalfAdder_xor1_5678_efgh" → "dut.xor1"
 */
function cleanNodeId(id: string): string {
  const parts = id.split(".");
  return parts
    .map((part) => {
      const segs = part.split("_");
      // Skip first segment (circuit name) and last two (timestamp, random)
      if (segs.length >= 4) return segs.slice(1, -2).join("_");
      if (segs.length >= 2) return segs[1];
      return segs[0];
    })
    .join(".");
}

/**
 * Get primitive type from a mangled node ID by looking at the flat circuit.
 */
function getNodeType(step: PropagationStep, trace: PropagationStep[]): string {
  // The nodeId contains the primitive type info — but we can also check
  // common patterns
  const id = step.nodeId;
  if (id.includes("_Switch_") || id.includes(": Switch")) return "Switch";
  if (id.includes("_Led_") || id.includes(": Led")) return "Led";
  if (id.includes("_Xor_")) return "Xor";
  if (id.includes("_And_")) return "And";
  if (id.includes("_Or_")) return "Or";
  if (id.includes("_Not_")) return "Not";
  return "?";
}

function describeStep(step: PropagationStep): string {
  const id = step.nodeId.toLowerCase();

  if (step.nodeId === '__seed__') {
    return `Scanning circuit for source nodes (no inputs). Found ${step.enqueued.length} nodes to seed the queue.`;
  }

  if (id.includes("switch")) {
    return `Source node — outputs initial value. No inputs to read.`;
  }
  if (id.includes("led")) {
    return `Reads input value and updates display.${!step.changed ? " Output unchanged — no dependents enqueued." : ""}`;
  }
  if (id.includes("xor")) {
    return `Reads two inputs, computes XOR.${step.changed ? " Output changed — enqueuing dependents." : " Output unchanged."}`;
  }
  if (id.includes("and")) {
    return `Reads two inputs, computes AND.${step.changed ? " Output changed — enqueuing dependents." : " Output unchanged."}`;
  }
  if (id.includes("or")) {
    return `Reads two inputs, computes OR.${step.changed ? " Output changed — enqueuing dependents." : " Output unchanged."}`;
  }
  return `Evaluating node.${step.changed ? " Output changed." : " Output unchanged."}`;
}

export function PropagationDemo() {
  const sim = useCircuitSimulator(DEMO_DSL);
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Run the real propagation trace
  const trace = useMemo((): PropagationStep[] => {
    try {
      const result = executeCircuitCode(DEMO_DSL);
      if (result.error || result.circuits.length === 0) return [];

      const { circuits, library } = result;
      const resolveCircuit = (name: string) => library.resolveCircuit(name);

      const prims = generatePrimitives(PRIMITIVE_DEFINITIONS) as Circuit[];
      const primNames = prims.map((p) => p.name);

      const topCircuit = circuits[circuits.length - 1];

      const flat = elaborate(topCircuit, {
        resolveCircuit,
        getAllPrimitiveNames: () => primNames,
      });

      return tracePropagation(flat, {
        resolveCircuit,
        getAllPrimitiveNames: () => primNames,
      });
    } catch (e) {
      console.error("Trace failed:", e);
      return [];
    }
  }, []);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
    setActiveStep(0);

    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      if (step >= trace.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsPlaying(false);
        setActiveStep(-1);
        return;
      }
      setActiveStep(step);
    }, 2500);
  }, [trace]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setActiveStep(-1);
  }, []);

  const currentStep = activeStep >= 0 && activeStep < trace.length ? trace[activeStep] : null;
  const currentLabel = currentStep ? cleanNodeId(currentStep.nodeId) : null;

  // Find which circuit-level node label matches for the focus prop
  const focusLabel = useMemo(() => {
    if (!currentStep || !sim.circuit) return null;
    // Try to find a node whose label or id matches the trace nodeId
    for (const node of sim.circuit.nodes) {
      const nodeLabel = node.label || node.id;
      // Plain key match (TS builder format: nodeId equals label)
      if (currentStep.nodeId === nodeLabel) return nodeLabel;
      // Fallback: mangled DSL format
      if (currentStep.nodeId.includes(`_${nodeLabel}_`)) return nodeLabel;
    }
    return null;
  }, [currentStep, sim.circuit]);

  const description = currentStep ? describeStep(currentStep) : null;

  if (!sim.ready || !sim.circuit) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 flex items-center justify-center h-48 text-gray-500 text-sm">
        Compiling circuit...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden my-6">
      {/* Controls */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-3">
        <button
          onClick={isPlaying ? stop : play}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors shrink-0 ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {isPlaying ? "Stop" : "Watch propagation"}
        </button>

        <span className="text-xs text-gray-500 shrink-0">
          {activeStep >= 0
            ? `Step ${activeStep + 1}/${trace.length}`
            : `${trace.length} evaluations`}
        </span>
      </div>

      {/* Queue visualization */}
      {activeStep >= 0 && (
        <div className="px-4 py-2 border-b border-gray-700/30 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 shrink-0">Queue:</span>
          {currentStep && currentStep.queueSnapshot.length > 0 ? (
            currentStep.queueSnapshot.map((nodeId, i) => (
              <span
                key={i}
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-900/30 text-amber-400 border border-amber-800/30"
              >
                {cleanNodeId(nodeId)}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-gray-600 font-mono">empty — propagation complete</span>
          )}
          {currentStep && currentStep.changed && currentStep.enqueued.length > 0 && (
            <>
              <span className="text-[10px] text-gray-600 shrink-0">←</span>
              <span className="text-[10px] text-green-500 shrink-0">
                +{currentStep.enqueued.length} enqueued
              </span>
            </>
          )}
        </div>
      )}

      {/* Description */}
      <div className="px-4 py-2.5 border-b border-gray-700/30 text-xs text-gray-400 min-h-[2.5rem]">
        {description && currentStep?.nodeId === '__seed__' ? (
          <>
            <code className="text-blue-400">seed</code>
            <span className="text-gray-600 mx-1.5">|</span>
            {description}
          </>
        ) : description && currentLabel ? (
          <>
            <code className="text-blue-400">{currentLabel}</code>
            <span className="text-gray-600 mx-1.5">|</span>
            {description}
          </>
        ) : isPlaying ? (
          "Starting..."
        ) : (
          "Click \"Watch propagation\" to see the real simulator event queue in action. Source nodes are seeded first, then each evaluation may enqueue dependents."
        )}
      </div>

      {/* Evaluation log */}
      {activeStep >= 0 && (
        <div className="px-4 py-2 border-b border-gray-700/30 flex flex-wrap gap-1.5">
          {trace.slice(0, activeStep + 1).map((step, i) => {
            if (step.nodeId === '__seed__') {
              return (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    i === activeStep ? "bg-purple-600 text-white" : "bg-purple-900/40 text-purple-400"
                  }`}
                >
                  seed ({step.enqueued.length})
                </span>
              );
            }
            const label = cleanNodeId(step.nodeId);
            return (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                  i === activeStep
                    ? "bg-blue-600 text-white"
                    : step.changed
                    ? "bg-green-900/40 text-green-400"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {label}
                {step.changed ? " ✓" : " ·"}
              </span>
            );
          })}
        </div>
      )}

      {/* Circuit */}
      <CircuitCanvas
        circuit={sim.circuit}
        componentLibrary={sim.componentLibrary ?? undefined}
        portValues={sim.portValues}
        sequentialState={sim.sequentialState}
        onToggleNode={sim.toggleNode}
        onSetNodeValue={sim.setNodeValue}
        height={280}
        focus={focusLabel ? [focusLabel] : undefined}
        theme="dark"
      />
    </div>
  );
}
