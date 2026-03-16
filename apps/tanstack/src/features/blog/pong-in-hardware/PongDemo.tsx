"use client";

import { useMemo } from "react";
import { usePongSimulator } from "./usePongSimulator";

const GRID_SIZE = 8;
const PIXEL_SIZE = 40;
const PIXEL_GAP = 3;
const TOTAL_SIZE = GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP;

/**
 * Extract pixel data from the simulator's sequential state.
 * The PongSimple circuit stores framebuffer pixels in DualPortRAM
 * at addresses 0-63 (8x8 grid).
 */
function usePixels(sequentialState: unknown): number[] {
  return useMemo(() => {
    const pixels = new Array(64).fill(0);
    const state = sequentialState as {
      currentState?: Map<string, unknown>;
    } | null;
    if (!state?.currentState) return pixels;

    for (const [nodeId, nodeState] of state.currentState) {
      if (nodeState instanceof Map && nodeId.toLowerCase().includes("ram")) {
        const mem = nodeState as Map<number, number>;
        for (let addr = 0; addr < 64; addr++) {
          pixels[addr] = mem.get(addr) ?? 0;
        }
        break;
      }
    }
    return pixels;
  }, [sequentialState]);
}

export function PongDemo() {
  const {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
  } = usePongSimulator();

  const pixels = usePixels(sim.sequentialState);

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling Pong circuit...</span>
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

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden">
      {/* Controls header */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Controls
        </span>
        <span className="text-xs text-gray-500">
          W/S = left paddle &middot; &uarr;/&darr; = right paddle
        </span>
        <div className="ml-auto flex gap-1">
          {["W", "S", "\u2191", "\u2193"].map((key) => (
            <kbd
              key={key}
              className="px-1.5 py-0.5 text-xs font-mono bg-gray-800 text-gray-300 rounded border border-gray-600"
            >
              {key}
            </kbd>
          ))}
        </div>
      </div>

      {/* Game screen */}
      <div className="flex justify-center py-8 bg-gray-950">
        <svg
          width={TOTAL_SIZE}
          height={TOTAL_SIZE}
          className="border-2 border-gray-700 rounded-lg bg-black"
          style={{ imageRendering: "pixelated" }}
        >
          {pixels.map((value, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            return (
              <rect
                key={index}
                x={x * (PIXEL_SIZE + PIXEL_GAP)}
                y={y * (PIXEL_SIZE + PIXEL_GAP)}
                width={PIXEL_SIZE}
                height={PIXEL_SIZE}
                fill={value !== 0 ? "#3b82f6" : "#1a1a2e"}
                rx={3}
              />
            );
          })}
        </svg>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-900/90">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
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
  );
}
