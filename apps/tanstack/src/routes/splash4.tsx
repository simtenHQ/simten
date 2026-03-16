import { createFileRoute, Link } from "@tanstack/react-router";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";

// --- Live NAND demo with visible DSL ---

const NAND_DSL = `
circuit NandDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node gate: Nand
    node out: Led
    connect in_a.out -> gate.a
    connect in_b.out -> gate.b
    connect gate.out -> out.in
  }
}`;

const NAND_DISPLAY = `circuit NandDemo {
  impl {
    node in_a: Switch
    node in_b: Switch
    node gate: Nand
    node out: Led
    connect in_a.out -> gate.a
    connect in_b.out -> gate.b
    connect gate.out -> out.in
  }
}`;

function HeroDemo() {
  const sim = useCircuitSimulator(NAND_DSL);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* DSL code */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4 flex flex-col">
        <div className="text-xs text-gray-500 mb-2 font-medium">DSL</div>
        <pre className="text-sm font-mono text-gray-300 leading-relaxed flex-1 overflow-auto">
          {NAND_DISPLAY}
        </pre>
      </div>
      {/* Live circuit */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">
          Live simulation · click the switches
        </div>
        <div className="h-[220px]">
          {sim.error ? (
            <div className="h-full flex items-center justify-center text-red-400 text-sm">
              {sim.error}
            </div>
          ) : !sim.ready ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
              Compiling...
            </div>
          ) : (
            <CircuitCanvas
              circuit={sim.circuit}
              portValues={sim.portValues}
              sequentialState={sim.sequentialState}
              onToggleNode={sim.toggleNode}
              drillDown={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Data ---

const FEATURES = [
  {
    title: "Hardware description language",
    description:
      "A purpose-built DSL for defining digital circuits. Declare components, wire them together, compose into hierarchies. The compiler validates types, detects cycles, and elaborates composites down to primitives.",
  },
  {
    title: "Cycle-accurate simulator",
    description:
      "Two-phase simulation separates combinational propagation from sequential state updates. 50+ primitives from logic gates to RAM. Testbenches with assertions. Waveform viewer. All in the browser.",
  },
  {
    title: "AI tutor via Claude",
    description:
      "An integrated AI assistant that can write circuits, run simulations, generate testbenches, and explain results. Also works as a Claude Code MCP server — build and verify circuits from your terminal.",
  },
];

const SHOWCASE_ITEMS = [
  {
    title: "8-bit ALU",
    stats: "145 lines · 8 operations · 3 status flags",
  },
  {
    title: "6502 CPU",
    stats: "3,000+ lines · 35 build stages · full test suite",
  },
  {
    title: "Snake game",
    stats: "157 lines · raster display · pure hardware",
  },
  {
    title: "Systolic array",
    stats: "421 lines · 2x2 matrix multiply · streaming",
  },
];

export const Route = createFileRoute("/splash4")({
  component: Splash4Page,
});

// --- Page ---

function Splash4Page() {
  return (
    <div className="bg-gray-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg tracking-tight">
            Turing Incomplete
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/charlesharris/turing-incomplete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <Link
              to="/"
              className="px-4 py-1.5 bg-white text-gray-950 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Open Editor
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-6 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
            A circuit simulator and hardware description language
          </h1>
          <p className="text-base text-gray-400 mb-8 max-w-2xl">
            Define digital circuits in code, simulate them in the browser, and
            build up from NAND gates to a working CPU. Open source,
            AI-assisted.
          </p>
          <HeroDemo />
        </div>
      </section>

      {/* Two entry points */}
      <section className="py-10 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4">
          {/* Web editor */}
          <div className="bg-gray-900/40 rounded-lg border border-gray-800 p-5">
            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
              Browser
            </div>
            <p className="text-sm text-gray-400 mb-4">
              DSL editor, visual canvas, simulation controls, and an AI tutor
              that writes and verifies circuits for you.
            </p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-white text-gray-950 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Open Editor
            </Link>
          </div>
          {/* Claude Code MCP */}
          <div className="bg-gray-900/40 rounded-lg border border-gray-800 p-5">
            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
              Claude Code
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Add the MCP server and Claude can write, simulate, test, and
              preview circuits — all from your terminal.
            </p>
            <div className="bg-gray-950 rounded-md border border-gray-800 px-3 py-2 font-mono text-sm text-gray-300 overflow-x-auto">
              <span className="text-gray-500 select-none">$ </span>
              npx @turing-incomplete/mcp
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="py-12 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold mb-4 text-gray-500 uppercase tracking-wide">
            Built with the simulator
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SHOWCASE_ITEMS.map((item) => (
              <div
                key={item.title}
                className="bg-gray-900/40 rounded-lg border border-gray-800 px-4 py-3"
              >
                <div className="text-sm font-semibold mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {item.stats}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link
            to="/"
            className="px-5 py-2.5 bg-white text-gray-950 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Open Editor
          </Link>
          <a
            href="https://github.com/charlesharris/turing-incomplete"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 border border-gray-700 text-gray-300 rounded-md text-sm font-medium hover:border-gray-500 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 px-6">
        <div className="max-w-5xl mx-auto text-gray-600 text-xs">
          Open source · Cycle-accurate simulation · Claude Code MCP server
        </div>
      </footer>
    </div>
  );
}
