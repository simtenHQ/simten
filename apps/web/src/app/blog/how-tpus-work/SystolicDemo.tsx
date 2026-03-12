"use client";
import { useMemo } from "react";
import { useSystolicSimulator } from "./useSystolicSimulator";
import { CircuitCanvas } from "@turing-incomplete/ui/embed";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Custom layout for the TestSystolic3x3 circuit.
 * Arranges nodes logically: A inputs top-left, B inputs bottom-left,
 * systolic array center, result displays right, controls at bottom.
 */
const SYSTOLIC_LAYOUT: Record<string, { x: number; y: number }> = {
  // Matrix A inputs (top-left, 3×3)
  a00: { x: 30, y: 30 },
  a01: { x: 170, y: 30 },
  a02: { x: 310, y: 30 },
  a10: { x: 30, y: 130 },
  a11: { x: 170, y: 130 },
  a12: { x: 310, y: 130 },
  a20: { x: 30, y: 230 },
  a21: { x: 170, y: 230 },
  a22: { x: 310, y: 230 },
  // Matrix B inputs (below A, 3×3)
  b00: { x: 30, y: 350 },
  b01: { x: 170, y: 350 },
  b02: { x: 310, y: 350 },
  b10: { x: 30, y: 450 },
  b11: { x: 170, y: 450 },
  b12: { x: 310, y: 450 },
  b20: { x: 30, y: 550 },
  b21: { x: 170, y: 550 },
  b22: { x: 310, y: 550 },
  // Systolic array composite (center)
  sys: { x: 520, y: 260 },
  // Result displays (right, 3×3)
  display_c00: { x: 780, y: 30 },
  display_c01: { x: 910, y: 30 },
  display_c02: { x: 1040, y: 30 },
  display_c10: { x: 780, y: 165 },
  display_c11: { x: 910, y: 165 },
  display_c12: { x: 1040, y: 165 },
  display_c20: { x: 780, y: 300 },
  display_c21: { x: 910, y: 300 },
  display_c22: { x: 1040, y: 300 },
  // Controls (bottom)
  start: { x: 520, y: 560 },
  done_led: { x: 780, y: 560 },
};

export function SystolicDemo() {
  const {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    isDone,
    handleStart,
    handleReset,
  } = useSystolicSimulator();

  // Build a label→nodeId map for reading input values
  const inputNodeIds = useMemo(() => {
    const map: Record<string, string> = {};
    if (!sim.circuit?.nodes) return map;
    const names = [
      "a00", "a01", "a02", "a10", "a11", "a12", "a20", "a21", "a22",
      "b00", "b01", "b02", "b10", "b11", "b12", "b20", "b21", "b22",
    ];
    for (const node of sim.circuit.nodes) {
      for (const name of names) {
        if (node.label === name || node.id === name) {
          map[name] = node.id;
        }
      }
    }
    return map;
  }, [sim.circuit]);

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling systolic array circuit...</span>
        </div>
      </div>
    );
  }

  if (sim.error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6">
        <div className="text-red-400 text-sm font-mono">{sim.error}</div>
      </div>
    );
  }

  // Read a port value by searching for a key containing the name
  const getPortValue = (name: string, suffix: string): number => {
    if (!sim.portValues) return 0;
    for (const [key, value] of sim.portValues) {
      if (key.includes(name) && key.includes(suffix)) {
        return typeof value === "number" ? value : 0;
      }
    }
    return 0;
  };

  // Read input node values (searches for nodeId.out in portValues)
  const getInputValue = (name: string): number => {
    const nodeId = inputNodeIds[name];
    if (!nodeId || !sim.portValues) return 0;
    const exact = sim.portValues.get(`${nodeId}.out`);
    if (typeof exact === "number") return exact;
    for (const [key, value] of sim.portValues) {
      if (key.includes(`_${name}_`) && key.endsWith(".out")) {
        return typeof value === "number" ? value : 0;
      }
    }
    return 0;
  };

  const getResult = (name: string): number => getPortValue(name, "display");

  return (
    <TooltipProvider delayDuration={300}>
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden">
      {/* Matrix display header */}
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Matrix A
            </span>
            <div className="font-mono text-gray-300 mt-1 text-xs">
              <div>[{getInputValue("a00")}, {getInputValue("a01")}, {getInputValue("a02")}]</div>
              <div>[{getInputValue("a10")}, {getInputValue("a11")}, {getInputValue("a12")}]</div>
              <div>[{getInputValue("a20")}, {getInputValue("a21")}, {getInputValue("a22")}]</div>
            </div>
          </div>
          <span className="text-gray-500 text-lg">&times;</span>
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Matrix B
            </span>
            <div className="font-mono text-gray-300 mt-1 text-xs">
              <div>[{getInputValue("b00")}, {getInputValue("b01")}, {getInputValue("b02")}]</div>
              <div>[{getInputValue("b10")}, {getInputValue("b11")}, {getInputValue("b12")}]</div>
              <div>[{getInputValue("b20")}, {getInputValue("b21")}, {getInputValue("b22")}]</div>
            </div>
          </div>
          <span className="text-gray-500 text-lg">=</span>
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Result C
            </span>
            <div
              className={`font-mono mt-1 text-xs ${isDone ? "text-green-400" : "text-gray-500"}`}
            >
              <div>
                [{getResult("c00")}, {getResult("c01")}, {getResult("c02")}]
              </div>
              <div>
                [{getResult("c10")}, {getResult("c11")}, {getResult("c12")}]
              </div>
              <div>
                [{getResult("c20")}, {getResult("c21")}, {getResult("c22")}]
              </div>
            </div>
          </div>
          {isDone && (
            <span className="ml-auto text-xs font-medium text-green-400 bg-green-900/30 px-2 py-1 rounded">
              Done
            </span>
          )}
        </div>
      </div>

      {/* Circuit canvas */}
      <CircuitCanvas
        circuit={sim.circuit}
        portValues={sim.portValues}
        sequentialState={sim.sequentialState}
        onToggleNode={sim.toggleNode}
        onSetNodeValue={sim.setNodeValue}
        height={480}
        nodePositions={SYSTOLIC_LAYOUT}
        autoLayout={false}
      />

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-900/90">
        <button
          onClick={handleStart}
          disabled={isRunning || isDone}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
        >
          Start
        </button>
        <button
          onClick={() => setIsRunning(!isRunning)}
          disabled={isDone}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          } disabled:opacity-40`}
        >
          {isRunning ? "Pause" : "Run"}
        </button>
        <button
          onClick={sim.tick}
          disabled={isRunning}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
        >
          Step
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Reset
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-400">Speed</label>
          <input
            type="range"
            min={1}
            max={100}
            value={101 - speed}
            onChange={(e) => setSpeed(101 - Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
        </div>
        <span className="text-xs text-gray-400 font-mono tabular-nums">
          Cycle {sim.cycleCount.toLocaleString()}
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}
