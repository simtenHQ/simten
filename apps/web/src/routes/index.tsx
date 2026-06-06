import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCircuitSimulator, CircuitEmbed } from "@simten/embed";
import { circuit, bit } from "@simten/core/circuit";
import { Xor, And, Or, DFlipFlop, Constant } from "@simten/core/std";
import { Eth_FrameInput, Eth_FrameParser, Eth_CRC32, Eth_ProtocolDecoder, Eth_AddrClassifier } from "@simten/core/std";
import { HighlightedCode } from "@/components/HighlightedCode";
import { Container } from "@/components/Container";
import { Section, SectionHeading } from "@/components/SectionHeading";
import { RV32IDebuggerPreview } from "@/features/learn/cpu-debugger/RV32IDebuggerPreview";
import { ClaudeDemoSection } from "@/features/splash/ClaudeDemoSection";
import { CodeWithHovers } from "@/features/splash/CodeWithHovers";
import { useSnakeSimulator } from "@/features/blog/snake-in-hardware/useSnakeSimulator";
import { usePongSimulator } from "@/features/blog/pong-in-hardware/usePongSimulator";

// ============================================================================
// Demo circuits
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

const DrilldownFullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
    inputs.a.to(ha1.a), inputs.b.to(ha1.b),
    ha1.sum.to(ha2.a), inputs.cin.to(ha2.b),
    ha2.sum.to(outputs.sum),
    ha1.carry.to(or1.a), ha2.carry.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});

const ShiftRegister4 = circuit('ShiftRegister4', {
  inputs: { din: bit },
  outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop(), ff1: DFlipFlop(), ff2: DFlipFlop(), ff3: DFlipFlop() },
  connect: ({ inputs, outputs, nodes: { ff0, ff1, ff2, ff3 } }) => [
    inputs.din.to(ff0.d),
    ff0.q.to(ff1.d, outputs.q0),
    ff1.q.to(ff2.d, outputs.q1),
    ff2.q.to(ff3.d, outputs.q2),
    ff3.q.to(outputs.q3),
  ],
});





// ============================================================================
// Route + Page
// ============================================================================

import { pageHead, softwareApplicationLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    ...pageHead({
      title: "Simten — Hardware design in TypeScript",
      titleExact: true,
      description:
        "A TypeScript HDL where npm is your testbench — from logic gates to a RISC-V CPU. Test circuits against real packets and firmware, then synthesize to Verilog.",
      path: "/",
    }),
    scripts: [softwareApplicationLd()],
  }),
  component: Splash5Page,
});

function Splash5Page() {
  return (
    <div className="bg-background text-foreground">
      <MobileAIHero />
      <ClaudeDemoSection autoPlay />
      <BentoFeatures />
      <DemoGallery />
    </div>
  );
}

// ============================================================================
// BentoFeatures
// ----------------------------------------------------------------------------
// 3×2 grid of "what does this thing do" cells, slotted between the hero and
// the heavy demo gallery. Modeled on Vercel/Linear/Anthropic landing bento
// grids — each cell is title + one-line description + subtle arrow link +
// a visual area at the bottom. Visuals are placeholder boxes for now; the
// plan is to drop in real little mockups (stripped CircuitEmbed, waveform
// timeline, terminal snippet, code snippet, etc.) cell-by-cell once the
// layout is approved.
// ============================================================================
function BentoFeatures() {
  return (
    <section className="hidden md:block py-20 lg:py-28 border-t border-border">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          <BentoCell
            title="Type-safe end to end"
            description="Circuits are TypeScript. Runs natively in Node, Bun, or browser — no testbench language, no codegen step."
            visual={<TypesafeBentoVisual />}
            href="/docs/component-model"
          />
          <BentoCell
            title="Bring any npm package"
            description="fast-check for property testing, D3 for visualization, the GCC RISC-V toolchain — your circuit code is just code."
            visual={<NpmBentoVisual />}
            href="/docs/examples"
          />
          <BentoCell
            title="Drop-in embeds"
            description="One component renders a fully interactive circuit anywhere — blogs, docs, MDX. Same engine as the editor."
            visual={<EmbedsBentoVisual />}
            href="/docs/building-custom-uis"
          />
          <BentoCell
            title="Composable to the gate"
            description="Double-click any composite to see its internals. CPU → decoder → multiplexer → NAND, all the way down."
            visual={<DrilldownBentoVisual />}
            href="/cpu/rv32i"
          />
          <BentoCell
            title="Wire it to Claude"
            description="An MCP server lets Claude write, simulate, and debug circuits live in your browser — describe, generate, fix, ship."
            visual={<MCPBentoVisual />}
            href="/docs/claude-code"
          />
          <BentoCell
            title="Rewind any cycle"
            description="Sequential circuits record every state. Step forward, spot the bug, jump back to the exact cycle it happened."
            visual={<TimeTravelBentoVisual />}
            href="/circuit"
          />
        </div>
      </Container>
    </section>
  );
}

function BentoCell({
  title,
  description,
  visual,
  href,
}: {
  title: string;
  description: string;
  visual: ReactNode;
  href?: string;
}) {
  return (
    <div className="bg-card p-6 lg:p-8 flex flex-col">
      <h3 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[14px] text-muted-foreground leading-snug">
        {description}
      </p>
      <div className="mt-5">
        {href ? (
          <Link
            to={href}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label={`Learn more about ${title}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        )}
      </div>
      <div className="mt-6 lg:mt-8 flex-1 min-h-[200px] rounded-lg border border-border/60 bg-muted/40 overflow-hidden relative">
        {visual}
      </div>
    </div>
  );
}

// "Type-safe end to end" — small IDE-style card with the HalfAdder source.
// Card is wider than the cell and anchored bottom-left, so the right edge
// and top get cropped by the cell's overflow-hidden, giving the
// "you're peeking at a real editor" look from Cursor's bento. Identifiers
// inside the code body get the same hover popups as the hero block.
const TYPESAFE_SNIPPET = `import { circuit, bit } from '@simten/core';
import { Xor, And, Or } from '@simten/core/std';
import { simulate } from '@simten/core/sim';

const HalfAdder = circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes:   { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

const FullAdder = circuit('FullAdder', {
  inputs:  { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes:   { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
    inputs.a.to(ha1.a),
    inputs.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inputs.cin.to(ha2.b),
    ha2.sum.to(outputs.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(outputs.cout),
  ],
});

// Same engine in Node — no codegen, no testbench.
const sim = simulate(FullAdder);
sim.set({ a: 1, b: 1, cin: 1 });
console.log(sim.get('sum'), sim.get('cout')); // 1, 1`;

// "Bring any npm package" — same IDE card chrome as the type-safe cell, but
// the file content swaps every ~3.5s through a handful of real npm-package
// snippets (figlet, fast-check, d3-force, GCC). All snippets render stacked
// with opacity transitions so the crossfade is smooth — only the active one
// is interactive (pointer-events-none on the rest). CodeWithHovers powers
// each snippet so the simten-API identifiers (ROM, simulate, etc.) light up
// the hover popups; non-API names (fc, figlet, forceSimulation) stay inert.
const NPM_SNIPPETS: { filename: string; code: string }[] = [
  {
    filename: "logo-rom.ts",
    code: `// figlet — ASCII art baked into a hardware ROM
import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small';
import { ROM, romFromBytes } from '@simten/core/std';

figlet.parseFont('Small', smallFont);
const banner = figlet.textSync('Simten', { font: 'Small' });
const bytes = [...banner].map(c => c.charCodeAt(0));

const Logo = ROM({ memory: romFromBytes(bytes) });`,
  },
  {
    filename: "adder.test.ts",
    code: `// fast-check — property-test the half adder
import * as fc from 'fast-check';
import { simulate } from '@simten/core/sim';

fc.assert(
  fc.property(fc.boolean(), fc.boolean(), (a, b) => {
    const sim = simulate(HalfAdder);
    sim.set({ a, b });
    return sim.get('sum') === (a !== b);
  })
);  // ✓ 100 random inputs passed`,
  },
  {
    filename: "layout.ts",
    code: `// d3-force — auto-layout the circuit graph
import { forceSimulation, forceLink, forceManyBody } from 'd3-force';

const layout = forceSimulation(nodes)
  .force('link', forceLink(edges).distance(80))
  .force('charge', forceManyBody().strength(-220))
  .stop()
  .tick(300);

for (const n of layout.nodes()) editor.move(n.id, n.x, n.y);`,
  },
  {
    filename: "boot.ts",
    code: `// GCC — compile Rust to RISC-V bytes, drop into ROM
import { execSync } from 'child_process';
import { ROM, romFromBytes } from '@simten/core/std';

execSync('cargo build --target riscv32i-unknown-none-elf');
const bin = readFileSync('target/.../boot.bin');

const Boot = ROM({ memory: romFromBytes([...bin]) });`,
  },
];

function NpmBentoVisual() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Respect reduced-motion: hold the first snippet, no cycling.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % NPM_SNIPPETS.length),
      3500,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex items-start p-4">
      <div className="relative w-[540px] flex-shrink-0 rounded-md border border-border bg-card shadow-md -mr-8">
        {/* Tab bar — filename swaps with the snippet. Single mount, content
            switches in place (no opacity tricks needed — the swap is fast
            enough that the bar just feels like a tab change). */}
        <div className="flex items-center h-7 px-3 border-b border-border bg-muted/60 gap-2">
          <div className="flex gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
            <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
            <span className="w-2 h-2 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground transition-opacity duration-300">
            {NPM_SNIPPETS[index].filename}
          </span>
        </div>

        {/* Stacked snippets — all rendered, only the active one is visible
            and interactive. Min-height locks the card so the layout doesn't
            jump as snippets of different lengths cycle through. */}
        <div className="relative" style={{ minHeight: 200 }}>
          {NPM_SNIPPETS.map((snip, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === index ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={i !== index}
            >
              <CodeWithHovers
                code={snip.code}
                enabled={i === index}
                className="text-[10.5px] font-mono leading-relaxed whitespace-pre py-2.5 px-3 m-0"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// "Drop-in embeds" — static IDE card showing the import + the JSX usage.
// Mirrors the snippet in the embed CTA section further down the page so
// the reader sees the same shape in both places.
const EMBED_SNIPPET = `import { CircuitEmbed } from '@simten/embed';
import { HalfAdder } from './half-adder';

// Live, interactive hardware — three lines.
export default function Post() {
  return (
    <article>
      <p>Here's a half adder you can poke at:</p>
      <CircuitEmbed circuit={HalfAdder} />
    </article>
  );
}`;

function EmbedsBentoVisual() {
  return (
    <div className="absolute inset-0 flex items-start p-4">
      <div className="w-[520px] flex-shrink-0 rounded-md border border-border bg-card shadow-md -mr-8">
        <div className="flex items-center h-7 px-3 border-b border-border bg-muted/60 gap-2">
          <div className="flex gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
            <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
            <span className="w-2 h-2 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            blog/post.tsx
          </span>
        </div>
        <CodeWithHovers
          code={EMBED_SNIPPET}
          className="text-[10.5px] font-mono leading-relaxed whitespace-pre py-2.5 px-3 m-0"
        />
      </div>
    </div>
  );
}

// "Composable to the gate" — nested cards illustrating drilldown. The
// outermost is a FullAdder; you "open it" to see a HalfAdder inside; open
// THAT to see an Xor; open Xor to see the underlying Nand gate. Each
// layer carries the same pulsing inspect badge used on real composite
// nodes in the editor, so the visual reuses the page's vocabulary.
function DrilldownBentoVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <DrilldownLayer name="FullAdder" depth={0}>
        <DrilldownLayer name="HalfAdder" depth={1}>
          <DrilldownLayer name="Xor" depth={2} />
        </DrilldownLayer>
      </DrilldownLayer>
    </div>
  );
}

function DrilldownLayer({
  name,
  depth,
  leaf,
  children,
}: {
  name: string;
  depth: number;
  leaf?: boolean;
  children?: ReactNode;
}) {
  // Outer layers are larger and more muted; the innermost gate is the
  // saturated focus point so the eye lands on the primitive at the bottom
  // of the drilldown.
  const muting = `${100 - depth * 18}%`;

  return (
    <div
      className="relative rounded-lg border border-border bg-card shadow-sm w-full"
      style={{
        padding: depth === 3 ? "10px 14px" : depth === 2 ? 12 : depth === 1 ? 14 : 16,
        opacity: muting,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-mono ${
            leaf
              ? "text-[12px] text-foreground font-semibold"
              : "text-[11px] text-foreground/80"
          }`}
        >
          {name}
        </span>
        {children && (
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-blue-500">
              <svg className="h-2 w-2 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14" y2="14" />
              </svg>
            </span>
          </span>
        )}
      </div>
      {children}
      {leaf && (
        <div className="mt-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          primitive · NAND gate
        </div>
      )}
    </div>
  );
}

// "Wire it to Claude" — dark terminal card snapshotting the MCP install +
// a tiny scripted Claude exchange (one prompt, two tool calls, a result).
// Intentionally dark so it stands out against the light cell background;
// mirrors the hero's TerminalWindow palette so the page reads as one
// design language. Same anchoring as the other code cells.
function MCPBentoVisual() {
  return (
    <div className="absolute inset-0 flex items-start p-4">
      <div className="w-[520px] flex-shrink-0 rounded-md border border-[#30363d] shadow-md -mr-8 overflow-hidden bg-[#0d1117]">
        <div className="flex items-center h-7 px-3 border-b border-[#30363d] bg-[#161b22] gap-2">
          <div className="flex gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
            <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
            <span className="w-2 h-2 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] font-mono text-gray-500">terminal</span>
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9px] text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            MCP connected
          </div>
        </div>
        <div className="px-3 py-3 font-mono text-[11px] leading-relaxed text-gray-300 space-y-0.5">
          <div className="text-gray-500">$ <span className="text-gray-200">claude mcp add simten npx @simten/mcp</span></div>
          <div className="text-emerald-400">✓ added simten</div>
          <div className="h-2" />
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">&gt;</span>
            <span className="text-gray-100">Build me a 2-bit counter with a reset.</span>
          </div>
          <div className="h-1" />
          <div className="flex items-start gap-2 text-gray-500">
            <span className="text-blue-400 shrink-0">&gt;</span>
            <span>write_circuit (simten)</span>
          </div>
          <div className="pl-5 text-gray-500">5 nodes, 9 connections, 0 errors</div>
          <div className="flex items-start gap-2 text-gray-500">
            <span className="text-blue-400 shrink-0">&gt;</span>
            <span>simulate_circuit (simten)</span>
          </div>
          <div className="pl-5 text-gray-500">simulation ready · counts 00 → 01 → 10 → 11</div>
          <div className="h-1" />
          <div className="text-gray-400">Your counter is live. Click <span className="text-gray-200">Tick</span> to advance.</div>
        </div>
      </div>
    </div>
  );
}

// "Rewind any cycle" — mini waveform viewer with a scrubbing playhead.
// Four signals (clk, count[0], count[1], q) drawn as SVG polylines over
// 16 cycles. The playhead is an absolute vertical line that slides with
// the cycle state, and the cycle counter above updates in sync.
const WAVEFORM_CYCLES = 16;
const CYCLE_WIDTH = 20;
const ROW_HEIGHT = 22;
const TRACE_TOP = 5;
const TRACE_BOT = 17;
const WAVEFORM_W = WAVEFORM_CYCLES * CYCLE_WIDTH; // 320

function squareTrace(period: number): string {
  // Build a proper square-wave polyline: horizontal segment for each
  // half-period, with a vertical transition at each boundary. Yields
  // pairs of (x,y) describing the alternating high/low corners.
  const pts: string[] = [];
  let high = true;
  let y = TRACE_TOP;
  pts.push(`0,${y}`);
  for (let c = 1; c <= WAVEFORM_CYCLES; c++) {
    const x = c * CYCLE_WIDTH;
    // Walk to the end of this cycle at the current level.
    pts.push(`${x},${y}`);
    // Transition at boundaries that are multiples of `period`.
    if (c % period === 0 && c < WAVEFORM_CYCLES) {
      high = !high;
      y = high ? TRACE_TOP : TRACE_BOT;
      pts.push(`${x},${y}`);
    }
  }
  return pts.join(" ");
}

const WAVEFORM_SIGNALS = [
  { name: "clk",      points: squareTrace(1) },
  { name: "count[0]", points: squareTrace(2) },
  { name: "count[1]", points: squareTrace(4) },
  { name: "q",        points: squareTrace(8) },
];

function TimeTravelBentoVisual() {
  const [cycle, setCycle] = useState(8);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let dir = 1;
    const id = window.setInterval(() => {
      setCycle((c) => {
        if (c >= 13) dir = -1;
        else if (c <= 3) dir = 1;
        return c + dir;
      });
    }, 320);
    return () => window.clearInterval(id);
  }, []);

  const LABEL_W = 52;
  const GAP = 12;
  const PAD = 12;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="w-[420px] rounded-md border border-border bg-card shadow-md overflow-hidden">
        <div className="flex items-center justify-between h-7 px-3 border-b border-border bg-muted/60">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Waveform
          </span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            Cycle <span className="text-foreground">{cycle}</span> / {WAVEFORM_CYCLES}
          </span>
        </div>

        <div className="relative" style={{ padding: PAD }}>
          {/* Signal traces */}
          {WAVEFORM_SIGNALS.map((sig) => (
            <div
              key={sig.name}
              className="flex items-center"
              style={{ gap: GAP, height: ROW_HEIGHT }}
            >
              <span
                className="shrink-0 text-[10px] font-mono text-muted-foreground tabular-nums"
                style={{ width: LABEL_W }}
              >
                {sig.name}
              </span>
              <svg width={WAVEFORM_W} height={ROW_HEIGHT} className="block">
                {/* Faint cycle gridlines */}
                {Array.from({ length: WAVEFORM_CYCLES + 1 }).map((_, i) => (
                  <line
                    key={i}
                    x1={i * CYCLE_WIDTH}
                    y1={0}
                    x2={i * CYCLE_WIDTH}
                    y2={ROW_HEIGHT}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    className="text-border/50"
                  />
                ))}
                <polyline
                  points={sig.points}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-blue-500 dark:text-blue-400"
                  strokeLinejoin="miter"
                />
              </svg>
            </div>
          ))}

          {/* Playhead — absolutely positioned relative to this container.
              `left` is computed: container padding + label width + gap +
              cycle offset. Animates with `transition: left`. */}
          <div
            className="absolute pointer-events-none transition-[left] duration-200 ease-linear"
            style={{
              left: PAD + LABEL_W + GAP + cycle * CYCLE_WIDTH,
              top: PAD - 2,
              height: WAVEFORM_SIGNALS.length * ROW_HEIGHT + 4,
              width: 1,
            }}
          >
            <div className="w-px h-full bg-foreground/80" />
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground" />
          </div>
        </div>

        <div className="flex items-center justify-between h-7 px-3 border-t border-border bg-muted/60">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ScrubberBtn>{"⏮"}</ScrubberBtn>
            <ScrubberBtn>{"◀"}</ScrubberBtn>
            <ScrubberBtn>{"▶"}</ScrubberBtn>
            <ScrubberBtn>{"⏭"}</ScrubberBtn>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
            time-travel
          </span>
        </div>
      </div>
    </div>
  );
}

function ScrubberBtn({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[9px] hover:bg-muted hover:text-foreground transition-colors">
      {children}
    </span>
  );
}

function TypesafeBentoVisual() {
  return (
    <div className="absolute inset-0 flex items-start p-4">
      {/* Inner "editor" card — fixed width wider than the cell and anchored
          top-left, with a negative right margin to extend further past the
          right edge. The snippet is long enough that the bottom of the
          card spills past the cell floor too, so both edges visibly clip
          (the Cursor "peek-through-the-frame" effect). */}
      <div className="w-[540px] flex-shrink-0 rounded-md border border-border bg-card shadow-md -mr-8">
        <div className="flex items-center h-7 px-3 border-b border-border bg-muted/60 gap-2">
          <div className="flex gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
            <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
            <span className="w-2 h-2 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            adders.ts
          </span>
        </div>
        <CodeWithHovers
          code={TYPESAFE_SNIPPET}
          className="text-[10.5px] font-mono leading-relaxed whitespace-pre py-2.5 px-3 m-0"
        />
      </div>
    </div>
  );
}

function MobileAIHero() {
  return (
    <section className="md:hidden px-5 pt-10 pb-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] text-muted-foreground mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Works with Claude + MCP
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.05] text-foreground">
        Describe hardware. Claude builds it. Test it like software.
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        A TypeScript HDL where the whole npm ecosystem is your testbench — drive a circuit with real packets, real firmware, any library you can <code>npm install</code>, and watch it run cycle-by-cycle. Synthesizable to Verilog.
      </p>
      <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3">
        <code className="font-mono text-[12px] text-foreground/80">
          <span className="text-muted-foreground/60 select-none">$ </span>
          claude mcp add simten npx @simten/mcp
        </code>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>Synthesizable Verilog</span>
        <span className="text-muted-foreground/40">·</span>
        <span>Runs on ULX3S</span>
        <span className="text-muted-foreground/40">·</span>
        <span>Cycle-accurate</span>
        <span className="text-muted-foreground/40">·</span>
        <span>Yosys + nextpnr</span>
      </div>
    </section>
  );
}

// ============================================================================
// Gallery
// ============================================================================

function DemoGallery() {
  return (
    <div className="relative py-16 md:py-24 md:animate-in md:fade-in md:duration-700 overflow-hidden">

      <Container className="relative">
        {/* Lead with the heavy proof — RV32I + Ethernet — to show the
            framework's range up front. Lighter playable demos follow.
            First Section overrides the default top margin since the
            DemoGallery wrapper already provides top padding. */}
        <Section className="mt-0">
          <div className="max-w-2xl mb-10 lg:mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">
              Scale to real-world complexity
            </h2>
            <p className="mt-4 text-base lg:text-lg text-muted-foreground">
              The framework already runs heavy systems in the browser — for example, a 5-stage pipelined RISC-V CPU executing GCC-compiled C, C++, and Rust, or an IEEE 802.3 Ethernet parser turning wire bytes into protocol fields.
            </p>
          </div>

          {/* Two flagship systems, stacked. RV32I leads, the Ethernet parser
              follows. (Was a diagonal overlap, which buried each card's content
              behind the other.) */}
          <div className="space-y-8">
            {/* RV32I CPU debugger */}
            <div className="relative w-full rounded-2xl bg-muted/60 p-3 lg:p-4 shadow-sm">
              <div
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                style={{ height: 520 }}
              >
                <RV32IDebuggerPreview />
              </div>
              <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-[11px] font-medium text-foreground shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                RV32I CPU debugger
                <Link
                  to="/cpu/rv32i"
                  className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open →
                </Link>
              </div>

              {/* Conformance receipts. Honest framing per the harness README —
                  simulation vs Spike, not silicon certification. The link is the
                  proof and doubles as the "what is Spike" gloss. */}
              <a
                href="https://github.com/simtenHQ/simten/blob/main/hardware/ulx3s/projects/cpu/archtest/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-foreground/90 shadow-sm transition-colors hover:border-emerald-500/40 hover:text-foreground"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 6.4 5 8.9 9.5 3.4" />
                </svg>
                Passes 38/38 RISC-V RV32I conformance tests vs Spike (in sim)
                <span aria-hidden="true" className="text-muted-foreground/70">
                  ↗
                </span>
              </a>
            </div>

            {/* Ethernet parser */}
            <div className="relative w-full rounded-2xl bg-muted/60 p-3 lg:p-4 shadow-sm">
              <EthernetParserCard />
              <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-[11px] font-medium text-foreground shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Ethernet parser
              </div>
            </div>
          </div>
        </Section>

        {/* And the lighter side — same engine, more fun. Wrapped in
            Section so it picks up the standard inter-section margin
            (mt-28 md:mt-36) below the Scale block. */}
        <Section>
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1]">
              No CPU. No code. Just gates.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Pong and Snake, built entirely from logic gates with no processor and no software. Play them here, then watch Snake run on a real ULX3S FPGA.
            </p>
          </div>

          {/* Featured games — Pong on the left, Snake on the right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <PongCard />
            <SnakeCard />
          </div>
        </Section>

        {/* Row 1.5: removed — drilldown showcase relocated below for tightness */}
        <div className="hidden">
          {/* placeholder kept so the diff stays small */}
        <div className="mt-32 rounded-lg border border-border overflow-hidden bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr]">
            {/* Left: explanation */}
            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:border-r border-border">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-sm shadow-blue-500/30">
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="6.5" cy="6.5" r="4.5" />
                    <line x1="10" y1="10" x2="14" y2="14" />
                  </svg>
                </span>
                <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">Drill-down</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-[1.15] mb-4">
                Explore inside any component
              </h3>
              <p className="text-[15px] text-foreground/75 leading-snug mb-5">
                Every composite is explorable. Double-click the pulsing
                {" "}<span className="relative inline-flex align-middle h-5 w-5 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="6.5" cy="6.5" r="4.5" />
                      <line x1="10" y1="10" x2="14" y2="14" />
                    </svg>
                  </span>
                </span>{" "}
                badge to open its internals — with full simulation and nested drill-down.
              </p>
              <div className="space-y-2 text-[12px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">1.</span>
                  <span>Double-click <strong className="text-foreground/80">fa</strong> (FullAdder) to see its two HalfAdders</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">2.</span>
                  <span>Double-click a <strong className="text-foreground/80">HalfAdder</strong> to see its XOR + AND gates</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">3.</span>
                  <span>Toggle switches — signals propagate through every level</span>
                </div>
              </div>
            </div>

            {/* Right: live circuit */}
            <div style={{ height: 320 }}>
              <CircuitEmbed
                circuit={DrilldownFullAdder}
                height={320}
                layout={{
                  a:    { x: 10,  y: 10 },
                  b:    { x: 10,  y: 110 },
                  cin:  { x: 10,  y: 210 },
                  dut:  { x: 200, y: 100 },
                  sum:  { x: 400, y: 40 },
                  cout: { x: 400, y: 200 },
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 1.6: Time-travel showcase */}
        <div className="mt-24 rounded-lg border border-border overflow-hidden bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr]">
            {/* Left: live circuit with full clock controls + time-travel */}
            <CircuitEmbed
              circuit={ShiftRegister4}
              height={340}
              initialInputs={{ din: 1 }}
              layout={{
                din: { x: 10, y: 140 },
                dut: { x: 160, y: 120 },
                q0:  { x: 310, y: 20 },
                q1:  { x: 310, y: 100 },
                q2:  { x: 310, y: 180 },
                q3:  { x: 310, y: 260 },
              }}
            />

            {/* Right: explanation */}
            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:border-l border-border">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 shadow-sm shadow-amber-500/30">
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="8" cy="8" r="6" />
                    <polyline points="8 4 8 8 11 10" />
                  </svg>
                </span>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Time-travel</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-[1.15] mb-4">
                Rewind any clock cycle
              </h3>
              <p className="text-[15px] text-foreground/75 leading-snug mb-5">
                Sequential circuits record every state. Step forward, spot something wrong, step back to the exact cycle it happened. No printf debugging — just rewind.
              </p>
              <div className="space-y-2 text-[12px] text-muted-foreground/80">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">1.</span>
                  <span>Toggle the <strong className="text-foreground">switch</strong> on, then <strong className="text-foreground">Tick</strong> a few times</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">2.</span>
                  <span>Watch the bit ripple through the four flip-flop stages</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">3.</span>
                  <span>Use <strong className="text-foreground">◀ ▶</strong> to scrub back and forth — every cycle is preserved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
        {/* end hidden wrapper */}

      </Container>

      <Container className="relative">

        {/* Verilog Export — honest framing */}
        <Section>
          <SectionHeading
            title="Export to Verilog"
            description={
              <>
                Synthesizable primitives export to structural Verilog. The RV32I CPU and Snake both flash to a ULX3S; the CPU is cross-validated against iverilog cycle-by-cycle. Running it from a clone needs the synth / verify / compile services started locally (Docker; <code className="text-xs">pnpm dev:synth</code>, <code className="text-xs">dev:verifier</code>, <code className="text-xs">dev:compiler</code>).{" "}
                <Link
                  to="/docs/$"
                  params={{ _splat: "hardware" }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Setup & how it works →
                </Link>
              </>
            }
          />
          <div className="grid grid-cols-2 gap-4">
            {/* TypeScript side */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-mono">circuit.ts</div>
              <HighlightedCode
                code={`const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});`}
                className="px-4 py-3 text-[11px] font-mono leading-relaxed overflow-x-auto m-0"
              />
            </div>
            {/* Verilog side */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">HalfAdder.v</span>
                <span className="text-[9px] text-emerald-500 font-medium">✓ verified against Icarus Verilog</span>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
<span className="text-muted-foreground/60">{"`timescale 1ns / 1ps\n\n"}</span>
<span className="text-violet-400">{"module"}</span>{" HalfAdder (\n"}
{"  "}<span className="text-violet-400">{"input"}</span>{" a,\n"}
{"  "}<span className="text-violet-400">{"input"}</span>{" b,\n"}
{"  "}<span className="text-violet-400">{"output"}</span>{" sum,\n"}
{"  "}<span className="text-violet-400">{"output"}</span>{" carry\n"}
{");\n\n"}
{"  "}<span className="text-violet-400">{"wire"}</span>{" w_xor1_out;\n"}
{"  "}<span className="text-violet-400">{"wire"}</span>{" w_and1_out;\n\n"}
{"  "}<span className="text-blue-400">{"assign"}</span>{" w_xor1_out = a ^ b;\n"}
{"  "}<span className="text-blue-400">{"assign"}</span>{" w_and1_out = a & b;\n\n"}
{"  "}<span className="text-blue-400">{"assign"}</span>{" sum = w_xor1_out;\n"}
{"  "}<span className="text-blue-400">{"assign"}</span>{" carry = w_and1_out;\n\n"}
<span className="text-violet-400">{"endmodule"}</span>
              </pre>
            </div>
          </div>
        </Section>

        {/* Deep dives — long-form companion posts */}
        <Section>
          <SectionHeading
            title="Long-form deep dives"
            description="Not diagrams. Live circuits verified against real specifications."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                slug: "aes-in-hardware",
                title: "AES in Hardware",
                hook: "Why Intel built AES-NI into the CPU",
                accent: "violet",
              },
              {
                slug: "chacha20-in-hardware",
                title: "ChaCha20 in Hardware",
                hook: "The cipher designed to avoid hardware — elegant in gates anyway",
                accent: "amber",
              },
              {
                slug: "building-a-cpu",
                title: "Building a CPU",
                hook: "From NAND gates to a working RISC-V processor",
                accent: "blue",
              },
            ].map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}` as string}
                className="group rounded-lg border border-border hover:border-border bg-card hover:bg-muted transition-all px-4 py-3.5"
              >
                <h4 className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors">
                  {post.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {post.hook}
                </p>
                <span className="inline-block mt-2.5 text-[11px] text-blue-400 group-hover:text-blue-300 transition-colors">
                  Read &rarr;
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 text-right">
            <Link to="/blog" className="text-[12px] text-muted-foreground/60 hover:text-foreground/80 transition-colors">
              All articles &rarr;
            </Link>
          </div>
        </Section>

        <div className="mt-28 md:mt-36 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <p className="text-[13px] text-muted-foreground/60">
            Or open the editor and start from scratch.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/circuit"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Open editor →
            </Link>
            <Link
              to="/learn"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn →
            </Link>
          </div>
        </div>
      </Container>

      {/* SiteFooter is rendered globally in __root.tsx */}
    </div>
  );
}

const GRID = 8;
const PX = 24;
const GAP = 2;

// ============================================================================
// Pong Card
// ============================================================================

const PONG_GRID = 16;
const PONG_PX = 12;
const PONG_GAP = 1;

function usePongPixels(sequentialState: unknown): number[] {
  return useMemo(() => {
    const pixels = new Array(PONG_GRID * PONG_GRID).fill(0);
    const state = sequentialState as { currentState?: Map<string, unknown> } | null;
    if (!state?.currentState) return pixels;
    for (const [nodeId, nodeState] of state.currentState) {
      if (nodeState instanceof Map && nodeId.toLowerCase().includes("ram")) {
        const mem = nodeState as Map<number, number>;
        for (let addr = 0; addr < PONG_GRID * PONG_GRID; addr++) {
          pixels[addr] = mem.get(addr) ?? 0;
        }
        break;
      }
    }
    return pixels;
  }, [sequentialState]);
}

function PongCard() {
  const { sim, isRunning, setIsRunning } = usePongSimulator();
  const pixels = usePongPixels(sim.sequentialState);
  const total = PONG_GRID * PONG_PX + (PONG_GRID - 1) * PONG_GAP;

  // Map a key code into the pong simulator's keyboard inputs.
  // Codes match the values usePongSimulator listens for on the global keydown.
  const sendKey = useCallback((code: number) => {
    const nodes = sim.circuit?.nodes ?? [];
    const ids: Record<string, string> = {};
    for (const node of nodes) {
      if (node.label === "keyboard0" || node.id === "keyboard0") ids.k0 = node.id;
      if (node.label === "keyboard1" || node.id === "keyboard1") ids.k1 = node.id;
    }
    if (ids.k0) sim.setNodeValue(ids.k0, code);
    if (ids.k1) sim.setNodeValue(ids.k1, code);
    // Release after a brief moment so it acts as a tap, not a hold.
    setTimeout(() => {
      if (ids.k0) sim.setNodeValue(ids.k0, 0);
      if (ids.k1) sim.setNodeValue(ids.k1, 0);
    }, 80);
  }, [sim]);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-card">
      <div className="h-[320px] sm:h-[360px] flex items-center justify-center bg-black p-4 sm:p-6">
        {sim.ready ? (
          <svg
            viewBox={`0 0 ${total} ${total}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ imageRendering: "pixelated" }}
          >
            {pixels.map((val, i) => (
              <rect
                key={i}
                x={(i % PONG_GRID) * (PONG_PX + PONG_GAP)}
                y={Math.floor(i / PONG_GRID) * (PONG_PX + PONG_GAP)}
                width={PONG_PX}
                height={PONG_PX}
                fill={val !== 0 ? "#22c55e" : "#111"}
                rx={2}
              />
            ))}
          </svg>
        ) : (
          <div className="text-muted-foreground/40 text-[11px] font-mono">Compiling…</div>
        )}
      </div>

      <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Pong</div>
          <div className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
            ~80 nodes · zero software
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={!sim.ready}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                isRunning
                  ? "bg-amber-500 hover:bg-amber-400 text-white"
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {isRunning ? "Pause" : "Play"}
            </button>
            {(
              [
                ["↑", 17], // W
                ["↓", 31], // S
              ] as [string, number][]
            ).map(([arrow, code]) => (
              <button
                key={code}
                onPointerDown={() => sendKey(code)}
                className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-accent text-muted-foreground text-[9px] transition-colors"
              >
                {arrow}
              </button>
            ))}
          </div>
        </div>
        <Link
          to="/blog/pong-in-hardware"
          className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          Read post →
        </Link>
      </div>
    </div>
  );
}

function SnakeCard() {
  const { sim, pixels, isRunning, setIsRunning, sendDirection } = useSnakeSimulator();
  const total = GRID * PX + (GRID - 1) * GAP;

  // Set default direction to right once ready
  const directionSetRef = useRef(false);
  useEffect(() => {
    if (sim.ready && !directionSetRef.current) {
      directionSetRef.current = true;
      sendDirection(1); // right (2-bit encoding: 0=up, 1=right, 2=down, 3=left)
    }
  }, [sim.ready, sendDirection]);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-card">
      {/* Preview — square so the grid fills the card at any width */}
      <div className="h-[320px] sm:h-[360px] flex items-center justify-center bg-black p-4 sm:p-6">
        {sim.ready ? (
          <svg
            viewBox={`0 0 ${total} ${total}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ imageRendering: "pixelated" }}
          >
            {pixels.map((val, i) => (
              <rect
                key={i}
                x={(i % GRID) * (PX + GAP)}
                y={Math.floor(i / GRID) * (PX + GAP)}
                width={PX}
                height={PX}
                fill={val !== 0 ? "#22c55e" : "#111"}
                rx={2}
              />
            ))}
          </svg>
        ) : (
          <div className="text-muted-foreground/40 text-[11px] font-mono">Compiling…</div>
        )}
      </div>

      {/* Info strip — matches CircuitEmbed */}
      <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Snake</div>
          <div className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
            ~100 nodes · zero software
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={!sim.ready}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                isRunning
                  ? "bg-amber-500 hover:bg-amber-400 text-white"
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {isRunning ? "Pause" : "Play"}
            </button>
            {(
              [
                ["↑", 0],
                ["←", 3],
                ["↓", 2],
                ["→", 1],
              ] as [string, number][]
            ).map(([arrow, code]) => (
              <button
                key={code}
                onPointerDown={() => sendDirection(code)}
                className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-accent text-muted-foreground text-[9px] transition-colors"
              >
                {arrow}
              </button>
            ))}
          </div>
        </div>
        <Link
          to="/circuit"
          search={{ example: "snake" }}
          className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          Try in the editor →
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Ethernet Parser Card
// ============================================================================

const CRC32_ETH = (() => {
  const t = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) >>> 0 : (c >>> 1) >>> 0;
    t[i] = c;
  }
  return t;
})();

function ethCRC32(data: number[]): number {
  let crc = 0xFFFFFFFF;
  for (const b of data) crc = (CRC32_ETH[(crc ^ b) & 0xFF] ^ (crc >>> 8)) >>> 0;
  return (~crc) >>> 0;
}

function buildEthFrame(dst: number[], src: number[], ethertype: number): number[] {
  const payload = Array(46).fill(0x42);
  const frame = [...dst, ...src, (ethertype >> 8) & 0xFF, ethertype & 0xFF, ...payload];
  const crc = ethCRC32(frame);
  frame.push(crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF);
  return frame;
}

const ETH_FRAMES = [
  { label: "IPv4 unicast",    dst: [0x00,0x1A,0x2B,0x3C,0x4D,0x5E], src: [0xDE,0xAD,0xBE,0xEF,0xCA,0xFE], ethertype: 0x0800 },
  { label: "ARP broadcast",   dst: [0xFF,0xFF,0xFF,0xFF,0xFF,0xFF],   src: [0xAA,0xBB,0xCC,0xDD,0xEE,0xFF], ethertype: 0x0806 },
  { label: "IPv6 multicast",  dst: [0x33,0x33,0x00,0x00,0x00,0x01],  src: [0xFE,0xDC,0xBA,0x98,0x76,0x54], ethertype: 0x86DD },
] as const;


function readEthPort(
  pv: ReadonlyMap<string, boolean | number> | null,
  nodeLabel: string,
  portName: string,
): number | boolean | null {
  if (!pv) return null;
  return pv.get(`${nodeLabel}.${portName}`) ?? null;
}

function formatMac(hi: number, lo: number): string {
  return [
    (lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF,
    (hi >>> 8) & 0xFF, hi & 0xFF,
  ].map(b => b.toString(16).padStart(2, "0")).join(":");
}

function useEthernetParser() {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameDoneSeenRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frame = ETH_FRAMES[frameIndex];
  const frameBytes = useMemo(
    () => buildEthFrame([...frame.dst], [...frame.src], frame.ethertype),
    [frame],
  );
  const ethernetCircuit = useMemo(() => circuit('Eth_802_3_Parser', {
    nodes: { frame_in: Eth_FrameInput, enable: Constant({ value: 1 }), parser: Eth_FrameParser, crc: Eth_CRC32, proto: Eth_ProtocolDecoder, addr: Eth_AddrClassifier },
    connect: ({ nodes: { frame_in, enable, parser, crc, proto, addr } }) => [
      enable.out.to(frame_in.enable),
      frame_in.tdata.to(parser.tdata, crc.data),
      frame_in.tkeep.to(parser.tkeep, crc.tkeep),
      frame_in.tvalid.to(parser.tvalid, crc.data_valid),
      frame_in.tlast.to(parser.tlast, crc.tlast),
      parser.ethertype.to(proto.ethertype),
      parser.dst_mac_hi.to(addr.dst_mac_hi),
      parser.dst_mac_lo.to(addr.dst_mac_lo),
    ],
  }), [frameBytes]);
  const sim = useCircuitSimulator(ethernetCircuit);

  useEffect(() => {
    if (!sim.ready) return;
    intervalRef.current = setInterval(() => sim.tick(), 600);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sim.ready, sim.tick]);

  useEffect(() => {
    if (!sim.portValues) return;
    const done   = !!readEthPort(sim.portValues, "parser",   "frame_done");
    const tvalid = !!readEthPort(sim.portValues, "frame_in", "tvalid");

    // Reset guard once the new frame is actually streaming
    if (tvalid && frameDoneSeenRef.current) {
      frameDoneSeenRef.current = false;
      return;
    }

    if (done && !tvalid && !frameDoneSeenRef.current) {
      frameDoneSeenRef.current = true;
      setTimeout(() => {
        setFrameIndex(i => (i + 1) % ETH_FRAMES.length);
      }, 3000);
    }
  }, [sim.cycleCount, sim.portValues]);

  return { sim, frameIndex, frame, frameBytes };
}

function EthFrameRow({ label, bytes, color, active, valid }: {
  label: string; bytes: string; color: string; active: boolean; valid: boolean;
}) {
  const palette: Record<string, { border: string; text: string }> = {
    blue:   { border: "border-blue-500",   text: "text-blue-600 dark:text-blue-400"   },
    violet: { border: "border-violet-500", text: "text-violet-600 dark:text-violet-400" },
    amber:  { border: "border-amber-500",  text: "text-amber-600 dark:text-amber-400"  },
    gray:   { border: "border-muted-foreground/40",   text: "text-muted-foreground"   },
    green:  { border: "border-green-600",  text: "text-green-600 dark:text-green-400"  },
  };
  const c = palette[color] ?? palette.gray;
  return (
    <div className={`flex items-center gap-2 py-0.5 border-l-2 pl-2 transition-all duration-150 ${active ? c.border : "border-transparent"}`}>
      <span className={`w-14 text-[9px] uppercase tracking-wide shrink-0 transition-colors ${active ? c.text : "text-muted-foreground/40"}`}>
        {label}
      </span>
      <span className={`font-mono text-[10px] transition-colors ${active ? "text-foreground" : valid ? "text-muted-foreground/60" : "text-muted-foreground/20"}`}>
        {bytes}
      </span>
    </div>
  );
}

function EthParsedField({ label, value, tag, tagColor, valid }: {
  label: string; value: string; tag?: string; tagColor?: string; valid: boolean;
}) {
  const tagCls: Record<string, string> = {
    blue:    "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/70",
    orange:  "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/70",
    emerald: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/70",
    violet:  "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/70",
  };
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-300 ${valid ? "opacity-100" : "opacity-20"}`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${valid ? "bg-emerald-400" : "bg-muted"}`} />
      <span className="text-[11px] text-muted-foreground font-mono w-20 shrink-0">{label}</span>
      <span className={`font-mono text-[11px] ${valid ? "text-foreground" : "text-muted-foreground/40"}`}>{value}</span>
      {tag && valid && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${tagCls[tagColor ?? "blue"] ?? tagCls.blue}`}>
          {tag}
        </span>
      )}
    </div>
  );
}

function EthernetParserCard() {
  const { sim, frameIndex, frame, frameBytes } = useEthernetParser();
  const pv = sim.portValues;

  const byteOff   = ((readEthPort(pv, "frame_in", "byte_offset") as number) ?? 0);
  const dstValid  = !!readEthPort(pv, "parser", "dst_mac_valid");
  const srcValid  = !!readEthPort(pv, "parser", "src_mac_valid");
  const typeValid = !!readEthPort(pv, "parser", "ethertype_valid");
  const frameDone = !!readEthPort(pv, "parser", "frame_done");
  const crcOk     = !!readEthPort(pv, "crc",    "crc_ok");
  const isIpv4    = !!readEthPort(pv, "proto",  "is_ipv4");
  const isArp     = !!readEthPort(pv, "proto",  "is_arp");
  const isIpv6    = !!readEthPort(pv, "proto",  "is_ipv6");
  const isBcast   = !!readEthPort(pv, "addr",   "is_broadcast");
  const isUcast   = !!readEthPort(pv, "addr",   "is_unicast");

  const dstHi  = ((readEthPort(pv, "parser", "dst_mac_hi") as number) ?? 0) >>> 0;
  const dstLo  = ((readEthPort(pv, "parser", "dst_mac_lo") as number) ?? 0) >>> 0;
  const srcHi  = ((readEthPort(pv, "parser", "src_mac_hi") as number) ?? 0) >>> 0;
  const srcLo  = ((readEthPort(pv, "parser", "src_mac_lo") as number) ?? 0) >>> 0;
  const etype  = ((readEthPort(pv, "parser", "ethertype")  as number) ?? 0) >>> 0;

  const hex = (start: number, end: number) =>
    frameBytes.slice(start, end).map(b => b.toString(16).padStart(2, "0")).join(" ");

  const active =
    byteOff < 6  ? "dst"     :
    byteOff < 12 ? "src"     :
    byteOff < 14 ? "type"    :
    byteOff < 60 ? "payload" : "fcs";

  const proto     = isIpv4 ? "IPv4" : isArp ? "ARP" : isIpv6 ? "IPv6" : "";
  const addrClass = isBcast ? "BROADCAST" : isUcast ? "UNICAST" : "";
  const addrColor = isBcast ? "orange" : "blue";
  const progress  = Math.min((byteOff / 64) * 100, 100);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="flex flex-col sm:flex-row" style={{ minHeight: 200 }}>
        {/* Left: raw frame bytes */}
        <div className="sm:w-[42%] shrink-0 border-b sm:border-b-0 sm:border-r border-border px-5 py-4 font-mono">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>incoming frame</span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
              frameIndex === 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400" :
              frameIndex === 1 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400" :
              "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400"
            }`}>
              {frame.label.toUpperCase()}
            </span>
          </div>
          <EthFrameRow label="dst mac" bytes={hex(0, 6)}   color="blue"   active={active === "dst"}     valid={dstValid}  />
          <EthFrameRow label="src mac" bytes={hex(6, 12)}  color="violet" active={active === "src"}     valid={srcValid}  />
          <EthFrameRow label="etype"   bytes={hex(12, 14)} color="amber"  active={active === "type"}    valid={typeValid} />
          <EthFrameRow label="payload" bytes={`${hex(14, 18)} …`} color="gray" active={active === "payload"} valid={false} />
          <EthFrameRow label="fcs"     bytes={hex(60, 64)} color="green"  active={active === "fcs"}     valid={crcOk}     />
          <div className="mt-4">
            <div className="h-0.5 bg-card rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/40 font-mono">
              <span>{byteOff} / 64 bytes</span>
              <span>{sim.cycleCount} cycles</span>
            </div>
          </div>
        </div>

        {/* Right: parsed output */}
        <div className="flex-1 px-6 py-4 flex flex-col justify-center gap-3.5">
          <EthParsedField
            label="dst_mac"
            value={dstValid ? formatMac(dstHi, dstLo) : "??:??:??:??:??:??"}
            tag={addrClass} tagColor={addrColor}
            valid={dstValid}
          />
          <EthParsedField
            label="src_mac"
            value={srcValid ? formatMac(srcHi, srcLo) : "??:??:??:??:??:??"}
            valid={srcValid}
          />
          <EthParsedField
            label="ethertype"
            value={typeValid ? `0x${etype.toString(16).padStart(4, "0")}` : "0x????"}
            tag={proto} tagColor="emerald"
            valid={typeValid}
          />
          <EthParsedField
            label="crc32"
            value={frameDone ? (crcOk ? "valid" : "invalid") : "..."}
            tag={crcOk ? "\u2713" : undefined} tagColor="emerald"
            valid={crcOk}
          />
        </div>
      </div>

      {/* Info strip */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-foreground">Ethernet Parser</span>
          <span className="text-[11px] text-muted-foreground/60 font-mono">MAC RX pipeline · Layer 2 · IEEE 802.3</span>
        </div>
        <div className="flex items-center gap-2">
          {ETH_FRAMES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === frameIndex ? "bg-blue-400" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}


