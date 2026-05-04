/**
 * Splash Hero
 *
 * The top-of-page introduction. A single centered window showing
 * a short TypeScript circuit definition on the left and the live
 * running circuit on the right, with a picker to cycle through a
 * handful of representative examples.
 *
 * Intentionally simpler than ClaudeDemoSection (which lives lower
 * on the page): no scripted animation, no typewriter, no MCP hook.
 * The goal is "what is this?" answered in under 3 seconds.
 */

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CircuitEmbed } from "@simten/embed";
import { circuit, bit } from "@simten/core/circuit";
import type { BuiltCircuit } from "@simten/core/circuit";
import { Xor, And, Or, Not, DFlipFlop } from "@simten/core/std";
import { Logo } from "@/components/Logo";
import { HighlightedCode } from "@/components/HighlightedCode";

type HeroLayout = Record<string, { x: number; y: number }>;

// ============================================================================
// Hero demo circuits
// ============================================================================

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { xor1: Xor, xor2: Xor, and1: And, and2: And, or1: Or },
  connect: ({ inputs, outputs, nodes: { xor1, xor2, and1, and2, or1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(xor2.a, and2.a),
    inputs.cin.to(xor2.b, and2.b),
    xor2.out.to(outputs.sum),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});

const Mux2to1 = circuit('Mux2to1', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: { not1: Not, and1: And, and2: And, or1: Or },
  connect: ({ inputs, outputs, nodes: { not1, and1, and2, or1 } }) => [
    inputs.sel.to(not1.in, and2.b),
    inputs.a.to(and1.a),
    not1.out.to(and1.b),
    inputs.b.to(and2.a),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(outputs.out),
  ],
});

const Counter2Bit = circuit('Counter2Bit', {
  outputs: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
    dff0.q.to(inv.in, xor1.b, outputs.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, outputs.bit1),
    xor1.out.to(dff1.d),
  ],
});

// HighlightedCode is imported from @/components/HighlightedCode.

// ============================================================================
// Demo registry
// ============================================================================

interface HeroDemo {
  key: string;
  label: string;
  circuit: BuiltCircuit;
  code: string;
  layout: HeroLayout;
}

const DEMOS: HeroDemo[] = [
  {
    key: "half-adder",
    label: "Half adder",
    circuit: HalfAdder,
    code: `const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});`,
    layout: {
      a:     { x: 10,  y: 0   },
      b:     { x: 10,  y: 130 },
      dut:   { x: 220, y: 65  },
      sum:   { x: 430, y: 0   },
      carry: { x: 430, y: 130 },
    },
  },
  {
    key: "full-adder",
    label: "Full adder",
    circuit: FullAdder,
    code: `const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { xor1: Xor, xor2: Xor, and1: And, and2: And, or1: Or },
  connect: ({ inputs, outputs, nodes: { xor1, xor2, and1, and2, or1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(xor2.a, and2.a),
    inputs.cin.to(xor2.b, and2.b),
    xor2.out.to(outputs.sum),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});`,
    layout: {
      a:    { x: 10,  y: 0   },
      b:    { x: 10,  y: 95  },
      cin:  { x: 10,  y: 190 },
      dut:  { x: 220, y: 95  },
      sum:  { x: 430, y: 30  },
      cout: { x: 430, y: 160 },
    },
  },
  {
    key: "counter",
    label: "2-bit counter",
    circuit: Counter2Bit,
    code: `const Counter2Bit = circuit('Counter2Bit', {
  outputs: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
    dff0.q.to(inv.in, xor1.b, outputs.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, outputs.bit1),
    xor1.out.to(dff1.d),
  ],
});`,
    layout: {
      dut:  { x: 10,  y: 60  },
      bit0: { x: 220, y: 0   },
      bit1: { x: 220, y: 130 },
    },
  },
  {
    key: "mux",
    label: "2-to-1 mux",
    circuit: Mux2to1,
    code: `const Mux2to1 = circuit('Mux2to1', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: { not1: Not, and1: And, and2: And, or1: Or },
  connect: ({ inputs, outputs, nodes: { not1, and1, and2, or1 } }) => [
    inputs.sel.to(not1.in, and2.b),
    inputs.a.to(and1.a),
    not1.out.to(and1.b),
    inputs.b.to(and2.a),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(outputs.out),
  ],
});`,
    layout: {
      a:   { x: 10,  y: 0   },
      b:   { x: 10,  y: 95  },
      sel: { x: 10,  y: 190 },
      dut: { x: 220, y: 95  },
      out: { x: 430, y: 95  },
    },
  },
];

// ============================================================================
// Header
// ============================================================================

function HeroHeader() {
  return (
    <header className="px-6 pt-5 pb-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Logo size={22} className="text-foreground/80 shrink-0" />
          <div className="font-semibold text-[18px] tracking-tight text-foreground/80">
            Simten
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <a
            href="https://github.com/simtenHQ/simten"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 hover:text-foreground/80 transition-colors"
            aria-label="GitHub"
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <Link
            to="/learn"
            className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-sm"
          >
            Learn
          </Link>
          <Link
            to="/blog"
            className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-sm"
          >
            Blog
          </Link>
          <Link
            to="/editor"
            className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-sm"
          >
            Editor
          </Link>
          <Link
            to="/docs/$"
            params={{ _splat: "" }}
            className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-sm"
          >
            Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ============================================================================
// Window chrome (simpler than ClaudeDemoSection's — no tabs, no MCP badge)
// ============================================================================

function HeroWindow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-border bg-card shadow-lg">
      <div className="flex-shrink-0 bg-muted px-4 h-10 flex items-center gap-3 border-b border-border">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex items-center bg-card rounded-full border border-border px-3 h-6 gap-2 min-w-0">
          <span className="text-[12px] text-muted-foreground font-mono truncate">
            simten.dev
          </span>
        </div>
        <div className="w-[52px]" />
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// The Hero itself
// ============================================================================

export function Hero() {
  const [demoKey, setDemoKey] = useState<string>(DEMOS[0].key);
  const demo = DEMOS.find((d) => d.key === demoKey) ?? DEMOS[0];

  const pickDemo = useCallback((key: string) => {
    setDemoKey(key);
  }, []);

  // Keyboard arrows cycle through demos (only when nothing else is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const idx = DEMOS.findIndex((d) => d.key === demoKey);
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const next = (idx + delta + DEMOS.length) % DEMOS.length;
        setDemoKey(DEMOS[next].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoKey]);

  return (
    <section className="bg-background text-foreground">
      <HeroHeader />

      {/* Desktop layout */}
      <div className="hidden md:block px-6 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 pt-20 md:pt-28">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Hardware simulation in your JavaScript runtime.
            </h1>
            <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Write circuits in TypeScript. Simulate them live in the browser.
              Import any npm library to drive, verify, or visualize them.
            </p>
          </div>

          <HeroWindow>
            <div className="flex h-[420px]">
              {/* Code pane */}
              <div className="w-[42%] shrink-0 border-r border-border overflow-y-auto bg-card">
                <HighlightedCode
                  code={demo.code}
                  className="text-[12px] font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap py-4 px-5 m-0"
                />
              </div>

              {/* Circuit pane */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex-1 min-h-0 relative">
                  <CircuitEmbed
                    key={demo.key}
                    circuit={demo.circuit}
                    layout={demo.layout}
                    height="100%"
                  />
                </div>
              </div>
            </div>
          </HeroWindow>

          {/* Demo picker */}
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground/60 mr-2 font-mono">
              // try another
            </span>
            {DEMOS.map((d) => (
              <button
                key={d.key}
                onClick={() => pickDemo(d.key)}
                className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                  d.key === demoKey
                    ? "border-foreground/30 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground/70 hover:text-foreground hover:border-foreground/20"
                }`}
              >
                {d.label}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground/40 ml-2 hidden lg:inline font-mono">
              ← → to cycle
            </span>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              to="/editor"
              className="text-[13px] text-foreground/80 hover:text-foreground transition-colors underline underline-offset-4"
            >
              Open the editor →
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link
              to="/learn"
              className="text-[13px] text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              Learn the basics
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile layout: stacked */}
      <div className="md:hidden px-5 pb-8">
        <div className="text-center mb-6 pt-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hardware simulation in your JavaScript runtime.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Write circuits in TypeScript. Simulate them live. Import any npm library.
          </p>
        </div>

        <HeroWindow>
          <div className="flex flex-col">
            <div className="h-[240px] border-b border-border">
              <CircuitEmbed
                key={demo.key}
                circuit={demo.circuit}
                layout={demo.layout}
                height="100%"
              />
            </div>
            <div className="max-h-[180px] overflow-y-auto bg-card">
              <HighlightedCode
                code={demo.code}
                className="text-[11px] font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap py-3 px-4 m-0"
              />
            </div>
          </div>
        </HeroWindow>

        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          {DEMOS.map((d) => (
            <button
              key={d.key}
              onClick={() => pickDemo(d.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                d.key === demoKey
                  ? "border-foreground/30 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground/70"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            to="/editor"
            className="text-[13px] text-foreground/80 hover:text-foreground transition-colors underline underline-offset-4"
          >
            Open the editor →
          </Link>
        </div>
      </div>
    </section>
  );
}
