
import { useMemo, useCallback } from "react";
import { useBreakoutSimulator } from "./useBreakoutSimulator";

const GRID_W = 32;
const GRID_H = 16;
const PIXEL_SIZE = 12;
const PIXEL_GAP = 1;
const TOTAL_W = GRID_W * PIXEL_SIZE + (GRID_W - 1) * PIXEL_GAP;
const TOTAL_H = GRID_H * PIXEL_SIZE + (GRID_H - 1) * PIXEL_GAP;

function LRPad({ onDirection }: { onDirection: (code: number) => void }) {
  const btn =
    "flex items-center justify-center w-16 h-16 rounded-xl bg-gray-700 active:bg-gray-500 text-gray-200 text-xl select-none transition-colors touch-manipulation";

  return (
    <div className="flex gap-4 justify-center" role="group" aria-label="Direction controls">
      <button
        className={btn}
        onPointerDown={() => onDirection(75)}
        onPointerUp={() => onDirection(0)}
        onPointerLeave={() => onDirection(0)}
        aria-label="Left"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 10l8-6v12z" /></svg>
      </button>
      <button
        className={btn}
        onPointerDown={() => onDirection(77)}
        onPointerUp={() => onDirection(0)}
        onPointerLeave={() => onDirection(0)}
        aria-label="Right"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M16 10l-8 6V4z" /></svg>
      </button>
    </div>
  );
}

/**
 * Extract pixel data from the simulator's sequential state.
 * Breakout stores framebuffer in DualPortRAM at addresses 0-63.
 */
function usePixels(sequentialState: unknown): number[] {
  const TOTAL_PIXELS = GRID_W * GRID_H;
  return useMemo(() => {
    const pixels = new Array(TOTAL_PIXELS).fill(0);
    const state = sequentialState as {
      currentState?: Map<string, unknown>;
    } | null;
    if (!state?.currentState) return pixels;

    for (const [nodeId, nodeState] of state.currentState) {
      // RasterDisplay stores pixels in its internal state map
      if (nodeState instanceof Map && nodeId.toLowerCase().includes("display")) {
        const mem = nodeState as Map<number, number>;
        for (let addr = 0; addr < TOTAL_PIXELS; addr++) {
          pixels[addr] = mem.get(addr) ?? 0;
        }
        break;
      }
    }
    return pixels;
  }, [sequentialState]);
}

/**
 * Color pixels by row: bricks are orange, paddle is blue, ball is white.
 */
function pixelColor(value: number, index: number): string {
  if (value === 0) return "#1a1a2e";
  const row = Math.floor(index / GRID_W);
  if (row <= 3) return "#f97316"; // bricks: orange
  if (row === 15) return "#3b82f6"; // paddle: blue
  return "#ffffff"; // ball: white
}

export function BreakoutDemo() {
  const {
    sim,
    isRunning,
    setIsRunning,
    handleReset,
    sendDirection,
  } = useBreakoutSimulator();

  const pixels = usePixels(sim.sequentialState);

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling Breakout circuit...</span>
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
    <div className="rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
      {/* Keyboard instructions */}
      <div className="hidden sm:flex px-4 py-3 border-b border-gray-700/50 items-center gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Controls
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          Arrow keys to move the paddle
        </span>
        <div className="ml-auto flex gap-1">
          {["\u2190", "\u2192"].map((key) => (
            <kbd
              key={key}
              className="px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded border border-gray-600"
            >
              {key}
            </kbd>
          ))}
        </div>
      </div>

      {/* Game screen */}
      <div className="flex justify-center py-6 sm:py-8 bg-gray-50 dark:bg-gray-950">
        <svg
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          className="border-2 border-gray-700 rounded-lg bg-black w-[min(100%-2rem,500px)]"
          style={{ imageRendering: "pixelated" }}
        >
          {pixels.map((value, index) => {
            const x = index % GRID_W;
            const y = Math.floor(index / GRID_W);
            return (
              <rect
                key={index}
                x={x * (PIXEL_SIZE + PIXEL_GAP)}
                y={y * (PIXEL_SIZE + PIXEL_GAP)}
                width={PIXEL_SIZE}
                height={PIXEL_SIZE}
                fill={pixelColor(value, index)}
                rx={3}
              />
            );
          })}
        </svg>
      </div>

      {/* Touch controls — mobile only */}
      <div className="sm:hidden py-4 border-t border-gray-700/50 bg-gray-100 dark:bg-gray-900/90">
        <LRPad onDirection={sendDirection} />
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-gray-900/90">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-gray-900 dark:text-white"
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
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
          Cycle {sim.cycleCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
