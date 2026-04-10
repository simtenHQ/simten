/**
 * Demo: Hardware Sorting Network
 *
 * Generates a Batcher odd-even merge sort network from an algorithm,
 * then simulates it as a combinational circuit. Data flows through
 * comparators — no clock, no loops, pure dataflow.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { circuit, bus } from "@simten/core/circuit";
import { simulate } from "@simten/core/sim";

export const Route = createFileRoute("/demos/sorting-network")({
  component: SortingNetworkPage,
});

// ============================================================================
// Sorting network generation (Batcher's odd-even merge sort)
// ============================================================================

type CompareSwap = [number, number]; // indices to compare and swap
type Stage = CompareSwap[];

/** Generate a Batcher odd-even merge sort network */
function generateBatcherNetwork(n: number): Stage[] {
  const stages: Stage[] = [];

  function merge(lo: number, hi: number, step: number) {
    if (step >= hi - lo) return;
    const doubleStep = step * 2;
    merge(lo, hi, doubleStep);
    merge(lo + step, hi, doubleStep);
    for (let i = lo + step; i < hi - step; i += doubleStep) {
      stages.push([[i, i + step]]);
    }
  }

  function sort(lo: number, hi: number) {
    if (hi - lo < 2) return;
    const mid = Math.floor((lo + hi) / 2);
    sort(lo, mid);
    sort(mid, hi);
    merge(lo, hi, 1);
  }

  sort(0, n);

  // Flatten into parallel stages (comparators that don't share wires can run in parallel)
  return optimizeStages(stages, n);
}

/** Merge single-comparator stages into parallel stages where possible */
function optimizeStages(stages: Stage[], n: number): Stage[] {
  const all: CompareSwap[] = stages.flat();
  const optimized: Stage[] = [];
  const used = new Set<number>();

  let i = 0;
  while (i < all.length) {
    const stage: CompareSwap[] = [];
    used.clear();
    let j = i;
    while (j < all.length) {
      const [a, b] = all[j];
      if (!used.has(a) && !used.has(b)) {
        stage.push([a, b]);
        used.add(a);
        used.add(b);
        // Remove from remaining
        all.splice(j, 1);
      } else {
        j++;
      }
    }
    if (stage.length > 0) optimized.push(stage);
    else break;
  }

  return optimized;
}

// ============================================================================
// Build a sorting circuit using circuit()
// ============================================================================

function buildSortingCircuit(n: number, stages: Stage[]) {
  // Each comparator-swap is a component that outputs min and max
  const CompSwap = circuit('CompSwap', {
    in: { a: bus(8), b: bus(8) },
    out: { lo: bus(8), hi: bus(8) },
    eval: ({ a, b }) => ({
      lo: Math.min(a, b),
      hi: Math.max(a, b),
    }),
  });

  // Build the network: inputs flow through stages of comparators
  // We'll simulate by running the algorithm on values directly
  // (building the full circuit with N×stages nodes is possible but
  //  the eval approach demonstrates the same thing more clearly)

  const inputNames: Record<string, any> = {};
  const outputNames: Record<string, any> = {};
  for (let i = 0; i < n; i++) {
    inputNames[`in${i}`] = bus(8);
    outputNames[`out${i}`] = bus(8);
  }

  return circuit('SortingNetwork', {
    in: inputNames,
    out: outputNames,
    eval: (inputs) => {
      // Run the sorting network on the inputs
      const wires = Array.from({ length: n }, (_, i) => inputs[`in${i}`] as number);

      for (const stage of stages) {
        for (const [a, b] of stage) {
          if (wires[a] > wires[b]) {
            [wires[a], wires[b]] = [wires[b], wires[a]];
          }
        }
      }

      const outputs: Record<string, number> = {};
      for (let i = 0; i < n; i++) {
        outputs[`out${i}`] = wires[i];
      }
      return outputs;
    },
  });
}

// ============================================================================
// Visualization
// ============================================================================

function NetworkVisualization({ n, stages, values, sorted }: {
  n: number;
  stages: Stage[];
  values: number[];
  sorted: number[];
}) {
  const width = 600;
  const height = Math.max(200, n * 40);
  const stageCount = stages.length;
  const xPad = 60;
  const yPad = 20;
  const wireSpacing = (height - yPad * 2) / (n - 1 || 1);
  const stageWidth = (width - xPad * 2) / (stageCount + 1);

  // Track wire values through each stage for coloring
  const wireValues: number[][] = [values.slice()];
  for (const stage of stages) {
    const prev = wireValues[wireValues.length - 1].slice();
    for (const [a, b] of stage) {
      if (prev[a] > prev[b]) [prev[a], prev[b]] = [prev[b], prev[a]];
    }
    wireValues.push(prev);
  }

  const valToColor = (val: number) => {
    const hue = (val / 255) * 270; // purple to red
    return `hsl(${hue}, 80%, 60%)`;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 400 }}>
      {/* Wires */}
      {Array.from({ length: n }, (_, i) => {
        const y = yPad + i * wireSpacing;
        return (
          <line key={`wire-${i}`} x1={0} y1={y} x2={width} y2={y}
            stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
        );
      })}

      {/* Input labels */}
      {values.map((v, i) => {
        const y = yPad + i * wireSpacing;
        return (
          <g key={`in-${i}`}>
            <circle cx={xPad - 10} cy={y} r={12} fill={valToColor(v)} fillOpacity={0.3} />
            <text x={xPad - 10} y={y + 4} textAnchor="middle" fontSize={11} fill={valToColor(v)} fontFamily="monospace" fontWeight="bold">
              {v}
            </text>
          </g>
        );
      })}

      {/* Comparators */}
      {stages.map((stage, si) => {
        const x = xPad + (si + 0.5) * stageWidth;
        return stage.map(([a, b], ci) => {
          const ya = yPad + a * wireSpacing;
          const yb = yPad + b * wireSpacing;
          const prevA = wireValues[si][a];
          const prevB = wireValues[si][b];
          const swapped = prevA > prevB;
          return (
            <g key={`comp-${si}-${ci}`}>
              {/* Vertical connector */}
              <line x1={x} y1={ya} x2={x} y2={yb}
                stroke={swapped ? "#f59e0b" : "#6b7280"} strokeWidth={2} strokeOpacity={0.8} />
              {/* Top dot */}
              <circle cx={x} cy={ya} r={4} fill={swapped ? "#f59e0b" : "#6b7280"} />
              {/* Bottom dot */}
              <circle cx={x} cy={yb} r={4} fill={swapped ? "#f59e0b" : "#6b7280"} />
              {/* Arrow showing swap direction */}
              {swapped && (
                <polygon
                  points={`${x - 3},${ya + 8} ${x + 3},${ya + 8} ${x},${ya + 14}`}
                  fill="#f59e0b" opacity={0.8}
                />
              )}
            </g>
          );
        });
      })}

      {/* Output labels */}
      {sorted.map((v, i) => {
        const y = yPad + i * wireSpacing;
        return (
          <g key={`out-${i}`}>
            <circle cx={width - xPad + 10} cy={y} r={12} fill={valToColor(v)} fillOpacity={0.3} />
            <text x={width - xPad + 10} y={y + 4} textAnchor="middle" fontSize={11} fill={valToColor(v)} fontFamily="monospace" fontWeight="bold">
              {v}
            </text>
          </g>
        );
      })}

      {/* Stage labels */}
      {stages.map((_, si) => {
        const x = xPad + (si + 0.5) * stageWidth;
        return (
          <text key={`stage-${si}`} x={x} y={height - 4} textAnchor="middle" fontSize={9}
            fill="currentColor" opacity={0.3} fontFamily="monospace">
            S{si}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================================================
// Page
// ============================================================================

function SortingNetworkPage() {
  const [n, setN] = useState(8);
  const [values, setValues] = useState(() => Array.from({ length: 8 }, () => Math.floor(Math.random() * 200) + 10));

  const stages = useMemo(() => generateBatcherNetwork(n), [n]);

  const circuit = useMemo(() => buildSortingCircuit(n, stages), [n, stages]);
  const sim = useMemo(() => simulate(circuit), [circuit]);

  const sorted = useMemo(() => {
    const inputs: Record<string, number> = {};
    for (let i = 0; i < n; i++) inputs[`in${i}`] = values[i] ?? 0;
    sim.set(inputs);
    const outputs: number[] = [];
    for (let i = 0; i < n; i++) outputs.push(sim.get(`out${i}` as any));
    return outputs;
  }, [sim, values, n]);

  const totalComparators = stages.reduce((sum, s) => sum + s.length, 0);

  const shuffle = useCallback(() => {
    setValues(Array.from({ length: n }, () => Math.floor(Math.random() * 200) + 10));
  }, [n]);

  const reverse = useCallback(() => {
    setValues(Array.from({ length: n }, (_, i) => Math.floor(((n - i) / n) * 200) + 10));
  }, [n]);

  const almostSorted = useCallback(() => {
    const arr = Array.from({ length: n }, (_, i) => Math.floor((i / n) * 200) + 10);
    // Swap two random adjacent elements
    const idx = Math.floor(Math.random() * (n - 1));
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setValues(arr);
  }, [n]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Hardware Sorting Network</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Batcher's odd-even merge sort — a fixed circuit of comparators that sorts any input in constant time.
          No clock, no loops, pure combinational dataflow.
        </p>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">Inputs:</span>
          {[4, 8, 16].map(size => (
            <button
              key={size}
              onClick={() => { setN(size); setValues(Array.from({ length: size }, () => Math.floor(Math.random() * 200) + 10)); }}
              className={`px-3 py-1.5 rounded text-xs ${n === size ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
            >
              {size}
            </button>
          ))}
          <span className="text-muted-foreground">|</span>
          <button onClick={shuffle} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Shuffle</button>
          <button onClick={reverse} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Reverse</button>
          <button onClick={almostSorted} className="px-3 py-1.5 bg-muted text-foreground rounded text-xs">Almost sorted</button>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-4 text-xs text-muted-foreground">
          <span>{n} inputs</span>
          <span>{stages.length} stages (depth)</span>
          <span>{totalComparators} comparators (area)</span>
          <span className="text-emerald-500">O(1) latency — combinational</span>
        </div>

        {/* Network visualization */}
        <div className="border border-border rounded-lg p-4 bg-muted/10 mb-4">
          <NetworkVisualization n={n} stages={stages} values={values} sorted={sorted} />
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-4">
            <span>Unsorted input →</span>
            <span className="text-amber-500">● = swap occurred</span>
            <span>→ Sorted output</span>
          </div>
        </div>

        {/* Input editor */}
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">Click values to edit:</div>
          <div className="flex gap-2 flex-wrap">
            {values.map((v, i) => (
              <input
                key={i}
                type="number"
                min={0}
                max={255}
                value={v}
                onChange={e => {
                  const next = [...values];
                  next[i] = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                  setValues(next);
                }}
                className="w-14 bg-muted rounded px-2 py-1 text-center font-mono text-sm"
              />
            ))}
            <span className="flex items-center text-xs text-muted-foreground">→</span>
            {sorted.map((v, i) => (
              <div key={`out-${i}`} className="w-14 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 text-center font-mono text-sm text-emerald-400">
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* Code */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <h2 className="text-sm font-semibold mb-2">Generated circuit</h2>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`// Batcher's odd-even merge sort → ${totalComparators} comparators
const stages = generateBatcherNetwork(${n})
// stages = ${JSON.stringify(stages.map(s => s.map(([a,b]) => `[${a},${b}]`).join(' ')).slice(0, 4).join(' → '))}${stages.length > 4 ? ' → ...' : ''}

const SortingNetwork = circuit('SortingNetwork', {
  in: { ${Array.from({length: Math.min(n, 4)}, (_, i) => `in${i}: bus(8)`).join(', ')}${n > 4 ? ', ...' : ''} },
  out: { ${Array.from({length: Math.min(n, 4)}, (_, i) => `out${i}: bus(8)`).join(', ')}${n > 4 ? ', ...' : ''} },
  eval: (inputs) => {
    // Run comparator network on inputs
    for (const stage of stages)
      for (const [a, b] of stage)
        if (wires[a] > wires[b]) swap(a, b)
    return outputs
  },
})

// Result: sorts ${n} values in ${stages.length} parallel steps
// In real hardware: ~${totalComparators * 2} gates, ${stages.length} gate delays`}</pre>
        </div>
      </div>
    </div>
  );
}
