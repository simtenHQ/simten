"use client";

import { useState, useMemo, lazy, Suspense, useRef, useEffect } from "react";
import {
  PRIMITIVE_DEFINITIONS,
  type CorePrimitiveDefinition,
} from "@turing-incomplete/core/simulator";

const CircuitEmbed = lazy(() =>
  import("@turing-incomplete/embed").then((m) => ({
    default: m.CircuitEmbed,
  }))
);

// Generate a minimal TS builder circuit that exercises a primitive
function generateDemoDsl(def: CorePrimitiveDefinition): string {
  const portType = (p: { portType: { kind: string; width?: number } }) =>
    p.portType.kind === "bus" ? `bus(${p.portType.width ?? 8})` : "bit";

  const ins = def.inputs.map((p) => `  .in('${p.name}', ${portType(p)})`).join("\n");
  const outs = def.outputs.map((p) => `  .out('${p.name}', ${portType(p)})`).join("\n");

  // Build node args from default params
  const params = (def.parameters ?? [])
    .filter((p) => p.defaultValue !== undefined)
    .map((p) => `${p.name}: ${JSON.stringify(p.defaultValue)}`)
    .join(", ");
  const nodeArgs = params ? `, { ${params} }` : "";

  // Connection lines
  const inputConns = def.inputs
    .map((p) => `    inp.${p.name}.to(dut.${p.name}),`)
    .join("\n");
  const outputConns = def.outputs
    .map((p) => `    dut.${p.name}.to(out.${p.name}),`)
    .join("\n");

  const allConns = [inputConns, outputConns].filter(Boolean).join("\n");

  const parts = [];
  if (ins) parts.push(`  in: { ${def.inputs.map(p => `${p.name}: ${portType(p)}`).join(', ')} },`);
  if (outs) parts.push(`  out: { ${def.outputs.map(p => `${p.name}: ${portType(p)}`).join(', ')} },`);
  parts.push(`  nodes: { dut: ${def.name} },`);
  if (nodeArgs) parts.push(`  nodeArgs: { dut: { ${params} } },`);
  if (allConns) {
    parts.push(`  connect: ({ in: inp, out, dut }) => [`);
    parts.push(allConns);
    parts.push(`  ],`);
  }

  return `const Demo = component('Demo', {\n${parts.join('\n')}\n})`;
}

// Category display order and labels
const CATEGORY_ORDER = [
  "logic-gates",
  "input-output",
  "arithmetic",
  "bus-operations",
  "utilities",
  "plexers",
  "sequential",
  "memory",
  "display",
  "io",
];

const CATEGORY_LABELS: Record<string, string> = {
  "logic-gates": "Logic Gates",
  "input-output": "I/O",
  arithmetic: "Arithmetic",
  "bus-operations": "Bus Operations",
  utilities: "Utilities",
  plexers: "Routing",
  sequential: "Sequential",
  memory: "Memory",
  display: "Display",
  io: "I/O Devices",
};

// Skip internal/advanced primitives that aren't useful for general learning
const SKIP_PREFIXES = ["RV32I_", "Eth_", "MemBusMux", "UART_TX", "NIC_FIFO"];

function shouldShow(name: string): boolean {
  return !SKIP_PREFIXES.some((p) => name.startsWith(p));
}

function PortList({ ports, label }: { ports: CorePrimitiveDefinition["inputs"]; label: string }) {
  if (ports.length === 0) return <span className="text-muted-foreground text-xs">none</span>;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {ports.map((p) => (
          <span
            key={p.name}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
          >
            <span className="text-foreground">{p.name}</span>
            <span className="text-muted-foreground">:</span>
            <span className="text-blue-600 dark:text-blue-400">
              {p.portType.kind === "bus" ? `Bus[${p.portType.width}]` : "Bit"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PrimitiveExplorer() {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group primitives by category
  const grouped = useMemo(() => {
    const groups: Record<string, CorePrimitiveDefinition[]> = {};
    for (const [name, def] of Object.entries(PRIMITIVE_DEFINITIONS)) {
      if (!shouldShow(name)) continue;
      const cat = def.category ?? "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(def);
    }
    return groups;
  }, []);

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grouped;
    const result: Record<string, CorePrimitiveDefinition[]> = {};
    for (const [cat, defs] of Object.entries(grouped)) {
      const matches = defs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
      );
      if (matches.length > 0) result[cat] = matches;
    }
    return result;
  }, [grouped, search]);

  const selected = selectedName ? PRIMITIVE_DEFINITIONS[selectedName] : null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalFiltered = Object.values(filtered).reduce((s, d) => s + d.length, 0);

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder="Search primitives... (e.g. Adder, Register, Mux)"
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
          {totalFiltered} primitives
        </span>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
          >
            {Object.keys(filtered).length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No primitives match "{search}"</div>
            ) : (
              CATEGORY_ORDER.filter((cat) => filtered[cat]).map((cat) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-card/80 sticky top-0">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  {filtered[cat].map((def) => (
                    <button
                      key={def.name}
                      onClick={() => {
                        setSelectedName(def.name);
                        setSearch("");
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2 ${
                        selectedName === def.name ? "bg-accent" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{def.name}</span>
                          <span className="text-xs text-muted-foreground">{def.icon}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{def.description}</div>
                      </div>
                      {(def.clocks?.length ?? 0) > 0 && (
                        <span className="text-[9px] rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 px-1.5 py-0.5 shrink-0">
                          CLK
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected primitive detail */}
      {selected ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">{selected.name}</span>
              <span className="text-muted-foreground">{selected.icon}</span>
              {(selected.clocks?.length ?? 0) > 0 && (
                <span className="text-[10px] rounded bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/50 dark:text-purple-400 dark:border-purple-800/50 px-1.5 py-0.5">
                  Sequential
                </span>
              )}
              <span className="text-[10px] rounded bg-muted text-muted-foreground border border-border px-1.5 py-0.5">
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
          </div>

          {/* Ports */}
          <div className="px-4 py-3 border-b border-border flex flex-wrap gap-6">
            <PortList ports={selected.inputs} label="Inputs" />
            <PortList ports={selected.outputs} label="Outputs" />
            {(selected.clocks?.length ?? 0) > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clocks</span>
                <div className="flex gap-1.5 mt-1">
                  {selected.clocks!.map((c) => (
                    <span key={c.name} className="inline-flex items-center rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs font-mono text-purple-700 dark:text-purple-300">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(selected.parameters?.length ?? 0) > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Parameters</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.parameters!.map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      <span className="text-amber-600 dark:text-amber-400">{p.name}</span>
                      {p.defaultValue !== undefined && (
                        <>
                          <span className="text-muted-foreground">=</span>
                          <span className="text-foreground/70">{String(p.defaultValue)}</span>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live demo */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading simulator...
              </div>
            }
          >
            <CircuitEmbed
              dsl={generateDemoDsl(selected)}
              height={280}
              showControls
              autoHarness
            />
          </Suspense>

          {/* DSL */}
          <details className="border-t border-border">
            <summary className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              View generated DSL
            </summary>
            <pre className="px-4 pb-3 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
              {generateDemoDsl(selected)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center h-48 text-muted-foreground text-sm">
          Select a primitive above to see its ports and a live demo
        </div>
      )}
    </div>
  );
}

// Keep PrimitiveLink for inline use in tables (backwards compat)
export function PrimitiveLink({
  name,
  children,
}: {
  name: string;
  children?: React.ReactNode;
}) {
  const hasDsl = name in PRIMITIVE_DEFINITIONS && shouldShow(name);

  if (!hasDsl) {
    return <code className="text-sm">{children ?? name}</code>;
  }

  return (
    <code className="text-blue-600 dark:text-blue-400 text-sm">{children ?? name}</code>
  );
}
