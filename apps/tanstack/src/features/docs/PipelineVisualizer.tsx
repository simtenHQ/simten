"use client";

import { useState, useMemo, lazy, Suspense } from "react";
import { compileDSL } from "@turing-incomplete/core/dsl";
import {
  elaborate,
  compileForSimulation,
  PRIMITIVE_DEFINITIONS,
  generatePrimitives,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/ui/editor/types";

const CircuitEmbed = lazy(() =>
  import("@turing-incomplete/embed").then((m) => ({
    default: m.CircuitEmbed,
  }))
);

const FULL_ADDER_DSL = `circuit HalfAdder {
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
}

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
}`;

type Tab = "dsl" | "ir" | "flat" | "numeric" | "live";

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "dsl", label: "DSL", description: "Source code" },
  { id: "ir", label: "Circuit IR", description: "Compiled objects" },
  { id: "flat", label: "Elaborated", description: "Flattened to primitives" },
  { id: "numeric", label: "Numeric", description: "Typed arrays" },
  { id: "live", label: "Live", description: "Running simulation" },
];

function NodeBadge({ type, label }: { type: string; label: string }) {
  const colors: Record<string, string> = {
    Xor: "bg-blue-900/50 text-blue-300 border-blue-700/50",
    And: "bg-green-900/50 text-green-300 border-green-700/50",
    Or: "bg-amber-900/50 text-amber-300 border-amber-700/50",
    Not: "bg-red-900/50 text-red-300 border-red-700/50",
    HalfAdder: "bg-purple-900/50 text-purple-300 border-purple-700/50",
  };
  const color = colors[type] ?? "bg-gray-800 text-gray-300 border-gray-700/50";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-mono ${color}`}>
      <span className="text-gray-500">{label}:</span> {type}
    </span>
  );
}

function ConnectionArrow({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
      <span className="text-gray-300">{from}</span>
      <span className="text-gray-600">→</span>
      <span className="text-gray-300">{to}</span>
    </div>
  );
}

export function PipelineVisualizer() {
  const [activeTab, setActiveTab] = useState<Tab>("dsl");

  const compiled = useMemo(() => {
    try {
      // Build a minimal library from primitives
      const prims = generatePrimitives(PRIMITIVE_DEFINITIONS) as Circuit[];
      const primMap = new Map<string, Circuit>();
      for (const p of prims) primMap.set(p.name, p);

      // Stage 1: Parse + compile to IR
      // addCircuit allows the compiler to register each circuit as it's compiled,
      // so FullAdder can reference HalfAdder defined earlier in the same file.
      const fullLib = new Map(primMap);
      const userLib = {
        resolveComponent: (name: string) => fullLib.get(name),
        addCircuit: (c: Circuit) => fullLib.set(c.name, c),
      };
      const { circuits, errors } = compileDSL(FULL_ADDER_DSL, userLib);
      if (errors.length > 0) return { error: errors[0].message };

      const resolveComponent = (name: string) => fullLib.get(name);

      // Stage 2: Elaborate the FullAdder
      const fullAdder = circuits.find((c) => c.name === "FullAdder");
      if (!fullAdder) return { error: "FullAdder not found" };

      const flat = elaborate(fullAdder, {
        resolveComponent,
        getAllPrimitiveNames: () => Array.from(primMap.keys()),
      });

      // Stage 3: Compile to numeric
      const numeric = compileForSimulation(flat, {
        resolveComponent,
        getAllPrimitiveNames: () => Array.from(primMap.keys()),
      });

      return { circuits, fullAdder, flat, numeric };
    } catch (e) {
      return { error: String(e) };
    }
  }, []);

  if ("error" in compiled) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-red-400 text-sm">
        {compiled.error}
      </div>
    );
  }

  const { circuits, fullAdder, flat, numeric } = compiled;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden my-6">
      {/* Tab bar */}
      <div className="flex border-b border-gray-700/50 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors shrink-0 ${
              activeTab === tab.id
                ? "bg-gray-800 text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <span className="text-[10px] font-mono text-gray-600 bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center">
              {i + 1}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "dsl" && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              The DSL source defines two circuits. <code className="text-blue-400">HalfAdder</code> is
              a composite used inside <code className="text-blue-400">FullAdder</code>. This is just text
              — no compilation has happened yet.
            </p>
            <pre className="text-xs font-mono text-gray-300 bg-gray-950 rounded-lg p-4 overflow-x-auto leading-relaxed max-h-80 overflow-y-auto">
              {FULL_ADDER_DSL}
            </pre>
          </div>
        )}

        {activeTab === "ir" && circuits && fullAdder && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              The parser and compiler produce <code className="text-blue-400">Circuit</code> objects.
              The FullAdder has 3 nodes — two HalfAdders and one Or gate. The HalfAdders are still
              composites at this stage.
            </p>
            <div className="space-y-3">
              <div className="text-xs text-gray-500 font-mono">
                compileDSL() → {circuits!.length} circuits
              </div>
              {circuits!.map((c) => (
                <div key={c.name} className="rounded-lg border border-gray-700/50 bg-gray-950 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">{c.name}</span>
                    <span className={`text-[10px] rounded px-1.5 py-0.5 ${
                      c.implementation.kind === "composite"
                        ? "bg-purple-900/50 text-purple-300 border border-purple-700/50"
                        : "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                    }`}>
                      {c.implementation.kind}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {c.inputs.map((p) => (
                      <span key={p.name} className="text-xs font-mono text-green-400">
                        → {p.name}
                      </span>
                    ))}
                    {c.outputs.map((p) => (
                      <span key={p.name} className="text-xs font-mono text-amber-400">
                        {p.name} →
                      </span>
                    ))}
                  </div>
                  {c.nodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {c.nodes.map((n) => (
                        <NodeBadge key={n.id} type={n.componentRef} label={n.id} />
                      ))}
                    </div>
                  )}
                  {c.connections.length > 0 && (
                    <div className="space-y-0.5">
                      {c.connections.map((conn, i) => (
                        <ConnectionArrow
                          key={i}
                          from={conn.source.nodeId ? `${conn.source.nodeId}.${conn.source.portName}` : conn.source.portName}
                          to={conn.target.nodeId ? `${conn.target.nodeId}.${conn.target.portName}` : conn.target.portName}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "flat" && flat && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Elaboration expands composites recursively. The two HalfAdders become four primitives
              (2× Xor, 2× And). The FullAdder's Or gate stays. Result:{" "}
              <strong className="text-white">{flat.nodes.length} primitive nodes</strong>,{" "}
              <strong className="text-white">{flat.connections.length} connections</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-700/50 bg-gray-950 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Primitive Nodes ({flat.nodes.length})
                </div>
                <div className="space-y-1">
                  {flat.nodes.map((n) => (
                    <div key={n.id} className="flex items-center gap-2 text-xs font-mono">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        n.primitiveType === "Xor" ? "bg-blue-400" :
                        n.primitiveType === "And" ? "bg-green-400" :
                        n.primitiveType === "Or" ? "bg-amber-400" : "bg-gray-400"
                      }`} />
                      <span className="text-gray-500 truncate">{n.id.split('_').slice(-3, -1).join('.')}</span>
                      <span className="text-gray-300 shrink-0">{n.primitiveType}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-700/50 bg-gray-950 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Connections ({flat.connections.length})
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {flat.connections.map((conn, i) => {
                    const srcLabel = conn.source.nodeId.split('_').slice(-3, -1).join('.') + '.' + conn.source.portName;
                    const tgtLabel = conn.target.nodeId.split('_').slice(-3, -1).join('.') + '.' + conn.target.portName;
                    return <ConnectionArrow key={i} from={srcLabel} to={tgtLabel} />;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "numeric" && numeric && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              The numeric compiler converts everything to typed arrays for cache-friendly evaluation.
              Node IDs become array indices. Port lookups become <code className="text-blue-400">Int32Array</code> reads.
              No strings in the hot path.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-700/50 bg-gray-950 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Summary</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nodes</span>
                    <span className="font-mono text-white">{numeric.nodeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Ports</span>
                    <span className="font-mono text-white">{numeric.portCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Source nodes (no inputs)</span>
                    <span className="font-mono text-white">
                      {Array.from(numeric.isSourceNode).filter(Boolean).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stateful nodes</span>
                    <span className="font-mono text-white">
                      {Array.from(numeric.hasState).filter(Boolean).length}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-700/50 bg-gray-950 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Node Index Table
                </div>
                <div className="space-y-0.5 text-xs font-mono max-h-48 overflow-y-auto">
                  {Array.from({ length: numeric.nodeCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-600 w-4 text-right">{i}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-300 truncate">
                        {numeric.indexToNodeId[i].split('_').slice(-3, -1).join('.')}
                      </span>
                      <span className="text-gray-600 ml-auto">
                        {numeric.nodeInputCount[i]}in/{numeric.nodeOutputCount[i]}out
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-700/50 bg-gray-950 p-3 sm:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Typed Arrays
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-gray-500">nodePortStart:</span>{" "}
                    <span className="text-blue-400">Uint32Array</span>
                    <span className="text-gray-600"> [{Array.from(numeric.nodePortStart).join(", ")}]</span>
                  </div>
                  <div>
                    <span className="text-gray-500">nodeInputCount:</span>{" "}
                    <span className="text-blue-400">Uint8Array</span>
                    <span className="text-gray-600"> [{Array.from(numeric.nodeInputCount).join(", ")}]</span>
                  </div>
                  <div>
                    <span className="text-gray-500">nodeOutputCount:</span>{" "}
                    <span className="text-blue-400">Uint8Array</span>
                    <span className="text-gray-600"> [{Array.from(numeric.nodeOutputCount).join(", ")}]</span>
                  </div>
                  <div>
                    <span className="text-gray-500">primitiveTypeIndex:</span>{" "}
                    <span className="text-blue-400">Uint8Array</span>
                    <span className="text-gray-600"> [{Array.from(numeric.primitiveTypeIndex).join(", ")}]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "live" && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              The simulator runs the numeric circuit. Toggle the switches to change inputs — values
              propagate through the event queue until the circuit stabilizes.
            </p>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                  Loading simulator...
                </div>
              }
            >
              <CircuitEmbed
                dsl={FULL_ADDER_DSL}
                height={280}
                showControls
                autoHarness
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
