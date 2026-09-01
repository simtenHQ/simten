import { bit, circuit } from '@simten/core/circuit';
import { And, DFlipFlop, Or, Xor } from '@simten/core/std';
import { CircuitEmbed } from '@simten/embed';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components/Container';
import { HighlightedCode } from '@/components/HighlightedCode';
import { Section, SectionHeading } from '@/components/SectionHeading';
import { usePongSimulator } from '@/features/blog/pong-in-hardware/usePongSimulator';
import { useSnakeSimulator } from '@/features/blog/snake-in-hardware/useSnakeSimulator';
import { RV32IDebuggerPreview } from '@/features/learn/cpu-debugger/RV32IDebuggerPreview';
import { ClaudeDemoSection } from '@/features/splash/ClaudeDemoSection';
import { CodeWithHovers } from '@/features/splash/CodeWithHovers';

// ============================================================================
// Demo circuits
// ============================================================================

// ============================================================================
// Route + Page
// ============================================================================

import { pageHead, softwareApplicationLd } from '@/lib/seo';

export const Route = createFileRoute('/')({
  head: () => ({
    ...pageHead({
      title: 'Simten | Hardware design in TypeScript',
      titleExact: true,
      description:
        'A TypeScript HDL where npm is your testbench, from logic gates to a RISC-V CPU. Test circuits against real firmware, then synthesize to Verilog.',
      path: '/',
    }),
    scripts: [softwareApplicationLd()],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <Container className="pt-10">
        <div className="md:hidden inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] text-muted-foreground mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Works with Claude + MCP
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.05] md:leading-[1.1] text-foreground">
          Write hardware in TypeScript. Test it with npm. Run it on an FPGA.
        </h1>
        {/* Only carries what the headline cannot: the h1 ends on "FPGA", which
            reads as "do I need hardware to try this?". Everything else the old
            subhead said (TypeScript, npm, Verilog) the headline already says. */}
        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-2xl">
          Runs in your browser. No toolchain to install.
        </p>
      </Container>
      <MobileHeroActions />
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
// grids: each cell is title + one-line description + subtle arrow link +
// a visual area at the bottom. Visuals are placeholder boxes for now; the
// plan is to drop in real little mockups (stripped CircuitEmbed, waveform
// timeline, terminal snippet, code snippet, etc.) cell-by-cell once the
// layout is approved.
// ============================================================================
function BentoFeatures() {
  return (
    <section className="py-12 md:py-20 lg:py-28">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border border-border">
          <BentoCell
            title="Type-safe end to end"
            description="Circuits are TypeScript. Runs natively in Node, Bun, or browser: no testbench language, no codegen step."
            visual={<TypesafeBentoVisual />}
            href="/docs/component-model"
          />
          <BentoCell
            title="Bring any npm package"
            description="fast-check for property testing, D3 for visualization, the GCC RISC-V toolchain. Your circuit code is just code."
            visual={<NpmBentoVisual />}
            href="/docs/examples"
          />
          <BentoCell
            title="Drop-in embeds"
            description="One component renders a fully interactive circuit anywhere: blogs, docs, MDX. Same engine as the editor."
            visual={<EmbedsBentoVisual />}
            href="/docs/building-custom-uis"
          />
          <BentoCell
            title="Wire it to your assistant"
            description="An MCP server lets Claude, Codex, Gemini, or Cursor write, simulate, and debug circuits live in your browser: describe, generate, fix, ship."
            visual={<MCPBentoVisual />}
            href="/docs/mcp-integration"
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
      <h3 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-[14px] text-muted-foreground leading-snug">{description}</p>
      <div className="mt-5">
        {href ? (
          <Link
            to={href}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label={`Learn more about ${title}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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

// "Type-safe end to end": small IDE-style card with the HalfAdder source.
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

// Same engine in Node: no codegen, no testbench.
const sim = simulate(FullAdder);
sim.set({ a: 1, b: 1, cin: 1 });
console.log(sim.get('sum'), sim.get('cout')); // 1, 1`;

// "Bring any npm package": same IDE card chrome as the type-safe cell, but
// the file content swaps every ~3.5s through a handful of real npm-package
// snippets (figlet, fast-check, d3-force, GCC). All snippets render stacked
// with opacity transitions so the crossfade is smooth; only the active one
// is interactive (pointer-events-none on the rest). CodeWithHovers powers
// each snippet so the simten-API identifiers (ROM, simulate, etc.) light up
// the hover popups; non-API names (fc, figlet, forceSimulation) stay inert.
const NPM_SNIPPETS: { filename: string; code: string }[] = [
  {
    filename: 'logo-rom.ts',
    code: `// figlet: ASCII art baked into a hardware ROM
import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small';
import { ROM, romFromBytes } from '@simten/core/std';

figlet.parseFont('Small', smallFont);
const banner = figlet.textSync('Simten', { font: 'Small' });
const bytes = [...banner].map(c => c.charCodeAt(0));

const Logo = ROM({ memory: romFromBytes(bytes) });`,
  },
  {
    filename: 'adder.test.ts',
    code: `// fast-check: property-test the half adder
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
    filename: 'layout.ts',
    code: `// d3-force: auto-layout the circuit graph
import { forceSimulation, forceLink, forceManyBody } from 'd3-force';

const layout = forceSimulation(nodes)
  .force('link', forceLink(edges).distance(80))
  .force('charge', forceManyBody().strength(-220))
  .stop()
  .tick(300);

for (const n of layout.nodes()) editor.move(n.id, n.x, n.y);`,
  },
  {
    filename: 'boot.ts',
    code: `// GCC: compile Rust to RISC-V bytes, drop into ROM
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
    if (typeof window === 'undefined') return;
    // Respect reduced-motion: hold the first snippet, no cycling.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % NPM_SNIPPETS.length), 3500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex items-start p-4">
      <div className="relative w-[540px] flex-shrink-0 rounded-md border border-border bg-card shadow-md -mr-8">
        {/* Tab bar: filename swaps with the snippet. Single mount, content
            switches in place (no opacity tricks needed; the swap is fast
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

        {/* Stacked snippets: all rendered, only the active one is visible
            and interactive. Min-height locks the card so the layout doesn't
            jump as snippets of different lengths cycle through. */}
        <div className="relative" style={{ minHeight: 200 }}>
          {NPM_SNIPPETS.map((snip, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
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

// "Drop-in embeds": static IDE card showing the import + the JSX usage.
// Mirrors the snippet in the embed CTA section further down the page so
// the reader sees the same shape in both places.
const EMBED_SNIPPET = `import { CircuitEmbed } from '@simten/embed';
import { HalfAdder } from './half-adder';

// Live, interactive hardware in three lines.
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
          <span className="text-[10px] font-mono text-muted-foreground">blog/post.tsx</span>
        </div>
        <CodeWithHovers
          code={EMBED_SNIPPET}
          className="text-[10.5px] font-mono leading-relaxed whitespace-pre py-2.5 px-3 m-0"
        />
      </div>
    </div>
  );
}

// "Composable to the gate": nested cards illustrating drilldown. The
// outermost is a FullAdder; you "open it" to see a HalfAdder inside; open
// THAT to see an Xor; open Xor to see the underlying Nand gate. Each
// layer carries the same pulsing inspect badge used on real composite
// nodes in the editor, so the visual reuses the page's vocabulary.

// "Wire it to Claude": dark terminal card snapshotting the MCP install +
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
          <div className="text-gray-500">
            $ <span className="text-gray-200">claude mcp add simten npx @simten/mcp</span>
          </div>
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
          <div className="text-gray-400">
            Your counter is live. Click <span className="text-gray-200">Tick</span> to advance.
          </div>
        </div>
      </div>
    </div>
  );
}

function TypesafeBentoVisual() {
  return (
    <div className="absolute inset-0 flex items-start p-4">
      {/* Inner "editor" card, fixed width wider than the cell and anchored
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
          <span className="text-[10px] font-mono text-muted-foreground">adders.ts</span>
        </div>
        <CodeWithHovers
          code={TYPESAFE_SNIPPET}
          className="text-[10.5px] font-mono leading-relaxed whitespace-pre py-2.5 px-3 m-0"
        />
      </div>
    </div>
  );
}

function MobileHeroActions() {
  return (
    <Container className="md:hidden pb-2">
      {/* Desktop gets the live demo in ClaudeDemoSection; mobile can't run it,
          so Snake stands in. Same job: proof, above the fold, in one tap. The
          `claude mcp add` command that used to sit here is unusable on a phone. */}
      <div className="mt-5">
        <SnakeCard />
      </div>
      <Link
        to="/docs/$"
        params={{ _splat: '' }}
        className="mt-4 flex w-fit items-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors px-5 py-3 text-sm font-medium"
      >
        Learn more →
      </Link>
    </Container>
  );
}

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
// Demo gallery
// ============================================================================

function DemoGallery() {
  return (
    <div className="relative md:animate-in md:fade-in md:duration-700 overflow-hidden">
      <Container className="relative">
        {/* Open with the playable ones: they need no explanation and they
            make the claim in one tap. The heavy RV32I proof follows. */}
        <Section>
          <SectionHeading title="No CPU. No code. Just gates." />

          {/* Featured games: Pong on the left, Snake on the right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <PongCard />
            {/* Mobile plays Snake in the hero, so only one instance mounts. */}
            <div className="hidden md:block">
              <SnakeCard />
            </div>
          </div>
        </Section>

        {/* Then the heavy proof, the RV32I CPU, for the range: the games
            show it is real, this shows how far it goes. */}
        <Section>
          <SectionHeading
            title="Scale to real-world complexity"
            description="The framework already runs heavy systems in the browser: for example, a 5-stage pipelined RISC-V CPU executing GCC-compiled C, C++, and Rust."
            cta={
              <Link
                to="/cpu/rv32i"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open the RV32I debugger →
              </Link>
            }
          />

          {/* RV32I CPU debugger demo */}
          <div>
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden h-auto sm:h-[520px]">
              <RV32IDebuggerPreview />
            </div>

            {/* Conformance receipt. Honest framing per the harness README:
                simulation vs Spike, not silicon certification. */}
            <a
              href="https://github.com/simtenHQ/simten/blob/main/hardware/ulx3s/projects/cpu/archtest/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-foreground/90 shadow-sm transition-colors hover:border-emerald-500/40 hover:text-foreground"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
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
              Passes the official riscv-arch-test RV32I suite (38/38), signature-matched against
              Spike (in sim)
              <span aria-hidden="true" className="text-muted-foreground/70">
                ↗
              </span>
            </a>
          </div>
        </Section>
      </Container>

      <Container className="relative">
        {/* Drilldown: the claim the whole project rests on, shown rather than stated. */}
        <Section>
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr]">
              {/* Left: explanation */}
              <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:border-r border-border">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-sm shadow-blue-500/30">
                    <svg
                      className="h-3.5 w-3.5 text-white"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="6.5" cy="6.5" r="4.5" />
                      <line x1="10" y1="10" x2="14" y2="14" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
                    Drill-down
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-[1.15] mb-4">
                  Explore inside any component
                </h3>
                <p className="text-[15px] text-foreground/75 leading-snug mb-5">
                  Every composite is explorable. Double-click the pulsing{' '}
                  <span className="relative inline-flex align-middle h-5 w-5 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <circle cx="6.5" cy="6.5" r="4.5" />
                        <line x1="10" y1="10" x2="14" y2="14" />
                      </svg>
                    </span>
                  </span>{' '}
                  badge to open its internals, with full simulation and nested drill-down.
                </p>
                <div className="space-y-2 text-[12px] text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">1.</span>
                    <span>
                      Double-click <strong className="text-foreground/80">fa</strong> (FullAdder) to
                      see its two HalfAdders
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">2.</span>
                    <span>
                      Double-click a <strong className="text-foreground/80">HalfAdder</strong> to
                      see its XOR + AND gates
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">3.</span>
                    <span>Toggle switches: signals propagate through every level</span>
                  </div>
                </div>
              </div>

              {/* Right: live circuit */}
              <div style={{ height: 320 }}>
                <CircuitEmbed
                  circuit={DrilldownFullAdder}
                  height={320}
                  layout={{
                    a: { x: 10, y: 10 },
                    b: { x: 10, y: 110 },
                    cin: { x: 10, y: 210 },
                    dut: { x: 200, y: 100 },
                    sum: { x: 400, y: 40 },
                    cout: { x: 400, y: 200 },
                  }}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Time travel is temporal, so prose cannot carry it. */}
        <Section>
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr]">
              {/* Left: live circuit with full clock controls + time-travel */}
              <CircuitEmbed
                circuit={ShiftRegister4}
                height={340}
                initialInputs={{ din: 1 }}
                layout={{
                  din: { x: 10, y: 140 },
                  dut: { x: 160, y: 120 },
                  q0: { x: 310, y: 20 },
                  q1: { x: 310, y: 100 },
                  q2: { x: 310, y: 180 },
                  q3: { x: 310, y: 260 },
                }}
              />

              {/* Right: explanation */}
              <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:border-l border-border">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 shadow-sm shadow-amber-500/30">
                    <svg
                      className="h-3.5 w-3.5 text-white"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="8" cy="8" r="6" />
                      <polyline points="8 4 8 8 11 10" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Time-travel
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-[1.15] mb-4">
                  Rewind any clock cycle
                </h3>
                <p className="text-[15px] text-foreground/75 leading-snug mb-5">
                  Sequential circuits record every state. Step forward, spot something wrong, step
                  back to the exact cycle it happened. No printf debugging, just rewind.
                </p>
                <div className="space-y-2 text-[12px] text-muted-foreground/80">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">1.</span>
                    <span>
                      Toggle the <strong className="text-foreground">switch</strong> on, then{' '}
                      <strong className="text-foreground">Tick</strong> a few times
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">2.</span>
                    <span>Watch the bit ripple through the four flip-flop stages</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">3.</span>
                    <span>
                      Use <strong className="text-foreground">◀ ▶</strong> to scrub back and forth;
                      every cycle is preserved
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Verilog Export, honest framing */}
        <Section>
          <SectionHeading
            title="Export to Verilog"
            description="Synthesizable primitives export to structural Verilog. The RV32I CPU and Snake both run on a real ULX3S FPGA, with the CPU cross-validated against Icarus Verilog cycle-by-cycle."
            cta={
              <Link
                to="/docs/$"
                params={{ _splat: 'hardware' }}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Setup &amp; how it works →
              </Link>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TypeScript side */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-mono">
                circuit.ts
              </div>
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
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ verified against Icarus Verilog
                </span>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">{'`timescale 1ns / 1ps\n\n'}</span>
                <span className="text-violet-400">{'module'}</span>
                {' HalfAdder (\n'}
                {'  '}
                <span className="text-violet-400">{'input'}</span>
                {' a,\n'}
                {'  '}
                <span className="text-violet-400">{'input'}</span>
                {' b,\n'}
                {'  '}
                <span className="text-violet-400">{'output'}</span>
                {' sum,\n'}
                {'  '}
                <span className="text-violet-400">{'output'}</span>
                {' carry\n'}
                {');\n\n'}
                {'  '}
                <span className="text-violet-400">{'wire'}</span>
                {' w_xor1_out;\n'}
                {'  '}
                <span className="text-violet-400">{'wire'}</span>
                {' w_and1_out;\n\n'}
                {'  '}
                <span className="text-blue-600 dark:text-blue-400">{'assign'}</span>
                {' w_xor1_out = a ^ b;\n'}
                {'  '}
                <span className="text-blue-600 dark:text-blue-400">{'assign'}</span>
                {' w_and1_out = a & b;\n\n'}
                {'  '}
                <span className="text-blue-600 dark:text-blue-400">{'assign'}</span>
                {' sum = w_xor1_out;\n'}
                {'  '}
                <span className="text-blue-600 dark:text-blue-400">{'assign'}</span>
                {' carry = w_and1_out;\n\n'}
                <span className="text-violet-400">{'endmodule'}</span>
              </pre>
            </div>
          </div>
        </Section>
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
      if (nodeState instanceof Map && nodeId.toLowerCase().includes('ram')) {
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
  const sendKey = useCallback(
    (code: number) => {
      const nodes = sim.circuit?.nodes ?? [];
      const ids: Record<string, string> = {};
      for (const node of nodes) {
        if (node.label === 'keyboard0' || node.id === 'keyboard0') ids.k0 = node.id;
        if (node.label === 'keyboard1' || node.id === 'keyboard1') ids.k1 = node.id;
      }
      if (ids.k0) sim.setNodeValue(ids.k0, code);
      if (ids.k1) sim.setNodeValue(ids.k1, code);
      // Release after a brief moment so it acts as a tap, not a hold.
      setTimeout(() => {
        if (ids.k0) sim.setNodeValue(ids.k0, 0);
        if (ids.k1) sim.setNodeValue(ids.k1, 0);
      }, 80);
    },
    [sim],
  );

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-card">
      <div className="h-[320px] sm:h-[360px] flex items-center justify-center bg-black p-4 sm:p-6">
        {sim.ready ? (
          <svg
            viewBox={`0 0 ${total} ${total}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          >
            {pixels.map((val, i) => (
              <rect
                key={i}
                x={(i % PONG_GRID) * (PONG_PX + PONG_GAP)}
                y={Math.floor(i / PONG_GRID) * (PONG_PX + PONG_GAP)}
                width={PONG_PX}
                height={PONG_PX}
                fill={val !== 0 ? '#22c55e' : '#111'}
                rx={2}
              />
            ))}
          </svg>
        ) : (
          <div className="text-muted-foreground text-[11px] font-mono">Compiling…</div>
        )}
      </div>

      <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Pong</div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            ~80 nodes · zero software
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={!sim.ready}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {isRunning ? 'Pause' : 'Play'}
            </button>
            {(
              [
                ['↑', 17], // W
                ['↓', 31], // S
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
      {/* Preview: square so the grid fills the card at any width */}
      <div className="h-[320px] sm:h-[360px] flex items-center justify-center bg-black p-4 sm:p-6">
        {sim.ready ? (
          <svg
            viewBox={`0 0 ${total} ${total}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          >
            {pixels.map((val, i) => (
              <rect
                key={i}
                x={(i % GRID) * (PX + GAP)}
                y={Math.floor(i / GRID) * (PX + GAP)}
                width={PX}
                height={PX}
                fill={val !== 0 ? '#22c55e' : '#111'}
                rx={2}
              />
            ))}
          </svg>
        ) : (
          <div className="text-muted-foreground text-[11px] font-mono">Compiling…</div>
        )}
      </div>

      {/* Info strip, matches CircuitEmbed */}
      <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Snake</div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            ~100 nodes · zero software
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={!sim.ready}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {isRunning ? 'Pause' : 'Play'}
            </button>
            {(
              [
                ['↑', 0],
                ['←', 3],
                ['↓', 2],
                ['→', 1],
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
          search={{ example: 'snake' }}
          className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          Try in the editor →
        </Link>
      </div>
    </div>
  );
}
