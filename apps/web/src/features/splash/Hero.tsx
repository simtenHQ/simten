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

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small';
import { CircuitEmbed, type CircuitEmbedHandle } from '@simten/embed';
import { circuit, bit, bus } from '@simten/core/circuit';
import type { BuiltCircuit } from '@simten/core/circuit';
import {
  Xor,
  And,
  Or,
  Not,
  DFlipFlop,
  Register,
  Adder,
  ROM,
  Constant,
  Console as ConsolePrimitive,
  romFromBytes,
} from '@simten/core/std';
import { HighlightedCode } from '@/components/HighlightedCode';
import { Container } from '@/components/Container';

type HeroLayout = Record<string, { x: number; y: number }>;

// ============================================================================
// Hero demo circuits
// ============================================================================

// figlet — a real npm package — renders ASCII-art text at module-load time.
// We bake the resulting bytes into a hardware ROM and stream them through a
// hardware Console, character by character, like a typewriter.
//
// The point: circuits are TypeScript, so the entire npm registry is available
// to you at design time.
figlet.parseFont('Small', smallFont);
const banner = figlet.textSync('Simten', { font: 'Small' });
// ROM layout: prefix a form-feed (clear-screen) byte so each pass through
// the 8-bit counter wipes the terminal before redrawing the banner.
// Remaining addresses past the banner are NULs (Console treats them as no-op).
const FF = 12;
const ascii = [...banner].map((c) => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) => {
  if (i === 0) return FF;
  return i <= ascii.length ? ascii[i - 1] : 0;
});

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

export const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: ConsolePrimitive },
  connect: ({ nodes: { src, term } }) => [src.byte.to(term.data), src.strobe.to(term.we)],
});

// Source string used by the splash hero picker — same content as DEMOS[0].code
// below, exported so ClaudeDemoSection can render it without duplicating the
// figlet ROM-generation logic. Kept as a free const rather than read out of
// DEMOS at runtime to avoid a circular-feeling self-reference.
export const FIGLET_DEMO_CODE = `import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small.js';
figlet.parseFont('Small', smallFont);

// Render ASCII-art at compile time with a real npm package,
// then stream the bytes through hardware — letter by letter.
const banner = figlet.textSync('Simten', { font: 'Small' });
const ascii = [...banner].map(c => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) =>
  i === 0 ? 12 : i <= ascii.length ? ascii[i - 1] : 0
);

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: Console },
  connect: ({ nodes: { src, term } }) => [
    src.byte.to(term.data),
    src.strobe.to(term.we),
  ],
});`;

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
  nodes: { dff0: DFlipFlop(), dff1: DFlipFlop(), inv: Not, xor1: Xor },
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
    key: 'figlet',
    label: 'Figlet → ROM',
    circuit: FigletDemo,
    code: `import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small.js';
figlet.parseFont('Small', smallFont);

// Render ASCII-art at compile time with a real npm package,
// then stream the bytes through hardware — letter by letter.
const banner = figlet.textSync('Simten', { font: 'Small' });
const ascii = [...banner].map(c => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) =>
  i === 0 ? 12 : i <= ascii.length ? ascii[i - 1] : 0
);

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }), // ← npm-computed ASCII art
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

// Top-level: drive a hardware Console with the streamed bytes.
const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: Console },
  connect: ({ nodes: { src, term } }) => [
    src.byte.to(term.data),
    src.strobe.to(term.we),
  ],
});`,
    layout: {
      src: { x: 0, y: 50 },
      term: { x: 240, y: 50 },
    },
  },
  {
    key: 'half-adder',
    label: 'Half adder',
    circuit: HalfAdder,
    code: `// Adds two 1-bit numbers. sum = a XOR b, carry = a AND b.
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
});`,
    layout: {
      a: { x: 10, y: 0 },
      b: { x: 10, y: 130 },
      dut: { x: 220, y: 65 },
      sum: { x: 430, y: 0 },
      carry: { x: 430, y: 130 },
    },
  },
  {
    key: 'full-adder',
    label: 'Full adder',
    circuit: FullAdder,
    code: `// Adds two bits plus a carry-in. Chain N of these to build an N-bit adder.
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
});`,
    layout: {
      a: { x: 10, y: 0 },
      b: { x: 10, y: 95 },
      cin: { x: 10, y: 190 },
      dut: { x: 220, y: 95 },
      sum: { x: 430, y: 30 },
      cout: { x: 430, y: 160 },
    },
  },
  {
    key: 'counter',
    label: '2-bit counter',
    circuit: Counter2Bit,
    code: `// Counts 0 → 1 → 2 → 3 → 0 on every clock tick using two flip-flops.
const Counter2Bit = circuit('Counter2Bit', {
  outputs: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop(), dff1: DFlipFlop(), inv: Not, xor1: Xor },
  connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
    dff0.q.to(inv.in, xor1.b, outputs.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, outputs.bit1),
    xor1.out.to(dff1.d),
  ],
});`,
    layout: {
      dut: { x: 10, y: 60 },
      bit0: { x: 220, y: 0 },
      bit1: { x: 220, y: 130 },
    },
  },
  {
    key: 'mux',
    label: '2-to-1 mux',
    circuit: Mux2to1,
    code: `// Picks input a or b based on sel. The basic building block for routing data.
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
});`,
    layout: {
      a: { x: 10, y: 0 },
      b: { x: 10, y: 95 },
      sel: { x: 10, y: 190 },
      dut: { x: 220, y: 95 },
      out: { x: 430, y: 95 },
    },
  },
];

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
          <span className="text-[12px] text-muted-foreground font-mono truncate">simten.dev</span>
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

  // Auto-start the figlet demo by handing off to the simulator's own auto-run
  // engine. This way the play/pause button (which talks to the same engine)
  // can stop it normally — we're not running a competing timer in user-land.
  // Other demos stay user-driven; switching demos clears any in-flight run.
  const desktopEmbedRef = useRef<CircuitEmbedHandle>(null);
  const mobileEmbedRef = useRef<CircuitEmbedHandle>(null);
  useEffect(() => {
    if (demoKey !== 'figlet') return;
    // Wait one tick for the embed to mount its handle.
    const id = setTimeout(() => {
      desktopEmbedRef.current?.startAutoRun(5);
      mobileEmbedRef.current?.startAutoRun(5);
    }, 0);
    return () => {
      clearTimeout(id);
      desktopEmbedRef.current?.stopAutoRun();
      mobileEmbedRef.current?.stopAutoRun();
    };
  }, [demoKey]);

  // Keyboard arrows cycle through demos (only when nothing else is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = DEMOS.findIndex((d) => d.key === demoKey);
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = (idx + delta + DEMOS.length) % DEMOS.length;
        setDemoKey(DEMOS[next].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [demoKey]);

  return (
    <section className="bg-background text-foreground">
      {/* Desktop layout */}
      <div className="hidden md:block pb-10">
        <Container>
          <div className="mb-8">
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-foreground">
              Or write it yourself.
            </h2>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">
              The same simulator Claude uses is open to you directly. Pick a circuit, edit the
              TypeScript, watch it run.
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
                    ref={desktopEmbedRef}
                    key={demo.key}
                    circuit={demo.circuit}
                    layout={demo.layout}
                    height="100%"
                    forkSource={demo.code}
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
                className={`text-[13px] px-3.5 py-1.5 rounded-full border transition-colors ${
                  d.key === demoKey
                    ? 'border-foreground/30 bg-foreground/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50'
                }`}
              >
                {d.label}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground/40 ml-2 hidden lg:inline font-mono">
              ← → to cycle
            </span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Link
              to="/circuit"
              className="inline-flex items-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors px-4 py-2 text-sm font-medium"
            >
              Open the editor →
            </Link>
            <Link
              to="/docs/$"
              params={{ _splat: 'how-it-works' }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works →
            </Link>
          </div>
        </Container>
      </div>

      {/* Mobile layout: stacked */}
      <div className="md:hidden px-5 pb-8">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold tracking-tight leading-[1.05] text-foreground">
            Or write it yourself.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The same simulator Claude uses is open to you. Pick a circuit and start editing.
          </p>
        </div>

        <HeroWindow>
          <div className="flex flex-col">
            <div className="h-[240px] border-b border-border">
              <CircuitEmbed
                ref={mobileEmbedRef}
                key={demo.key}
                circuit={demo.circuit}
                layout={demo.layout}
                height="100%"
                forkSource={demo.code}
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
              className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
                d.key === demoKey
                  ? 'border-foreground/30 bg-foreground/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link
            to="/circuit"
            className="inline-flex items-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors px-4 py-2 text-sm font-medium"
          >
            Open the editor →
          </Link>
          <Link
            to="/learn"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Learn the basics →
          </Link>
        </div>
      </div>
    </section>
  );
}
