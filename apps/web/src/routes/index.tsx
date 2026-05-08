import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCircuitSimulator, CircuitEmbed } from "@simten/embed";
import { circuit, bit } from "@simten/core/circuit";
import { Xor, And, Or, DFlipFlop, Constant, romFromBytes } from "@simten/core/std";
import { Eth_FrameInput, Eth_FrameParser, Eth_CRC32, Eth_ProtocolDecoder, Eth_AddrClassifier } from "@simten/core/std";
import { HighlightedCode } from "@/components/HighlightedCode";
import { Section, SectionHeading } from "@/components/SectionHeading";
import { RV32IDebuggerPreview } from "@/features/learn/cpu-debugger/RV32IDebuggerPreview";
import { ClaudeCTA } from "@/features/splash/ClaudeCTA";
import { ClaudeDemoSection } from "@/features/splash/ClaudeDemoSection";
import { Hero } from "@/features/splash/Hero";
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
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
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
      title: "Simten — Hardware simulation in TypeScript",
      titleExact: true,
      description:
        "Build and simulate digital circuits in TypeScript. From single gates to full RISC-V CPUs — all running live in the browser.",
      path: "/",
    }),
    scripts: [softwareApplicationLd()],
  }),
  component: Splash5Page,
});

function Splash5Page() {
  return (
    <div className="bg-background text-foreground">
      <Hero />
      <DemoGallery />
      <ClaudeDemoSection />
    </div>
  );
}

// ============================================================================
// Gallery
// ============================================================================

const PM_TABS = [
  { label: "npm", command: (pkg: string) => `npm install ${pkg}` },
  { label: "pnpm", command: (pkg: string) => `pnpm add ${pkg}` },
  { label: "yarn", command: (pkg: string) => `yarn add ${pkg}` },
  { label: "bun", command: (pkg: string) => `bun add ${pkg}` },
] as const;

function PackageManagerTabs({ package: pkg }: { package: string }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const cmd = PM_TABS[active].command(pkg);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cmd]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center border-b border-border">
        {PM_TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              i === active
                ? "text-foreground border-b-2 border-blue-500 -mb-px"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <code className="text-[12px] font-mono text-muted-foreground">
          <span className="text-muted-foreground/60 select-none">$ </span>
          {cmd}
        </code>
        <button
          onClick={copy}
          className="text-muted-foreground/60 hover:text-foreground/80 transition-colors shrink-0 ml-3"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function DemoGallery() {
  return (
    <div className="relative px-6 py-16 md:py-24 md:animate-in md:fade-in md:duration-700 overflow-hidden">

      <div className="relative max-w-6xl mx-auto">
        {/* Bridge headline — umbrella for Act 1 (demos) */}
        <div className="mb-20 max-w-5xl">
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            <span className="text-foreground">Text in. Live circuit out.</span>{" "}
            <span className="text-muted-foreground">All in your browser.</span>
          </h2>
        </div>

        {/* Row 1: Featured games — Pong on the left, Snake on the right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <PongCard />
          <SnakeCard />
        </div>

        {/* Row 1.1: Embed CTA — every demo on this page is a <CircuitEmbed /> */}
        <Section>
          <SectionHeading
            title="Drop it in your blog or docs"
            description={
              <>
                Every demo on this page is a{" "}
                <code className="font-mono text-[0.9em] px-1.5 py-0.5 rounded bg-muted text-foreground/90">
                  &lt;CircuitEmbed /&gt;
                </code>
                {" "}— live, interactive hardware in 3 lines.
              </>
            }
          />
          <PackageManagerTabs package="@simten/embed" />
          <div className="rounded-lg border border-border bg-card overflow-hidden mt-4">
            <pre className="px-4 py-3 text-[12px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
              <span className="text-violet-400">{"import"}</span>{" { CircuitEmbed } "}
              <span className="text-violet-400">{"from"}</span>{" "}
              <span className="text-green-400">{"'@simten/embed'"}</span>
              {"\n"}
              <span className="text-violet-400">{"import"}</span>{" { myCircuit } "}
              <span className="text-violet-400">{"from"}</span>{" "}
              <span className="text-green-400">{"'./my-circuit'"}</span>
              {"\n\n"}
              <span className="text-muted-foreground">{"// Compiles, simulates, and renders — in one component"}</span>
              {"\n"}
              {"<"}
              <span className="text-blue-400">{"CircuitEmbed"}</span>
              {"\n  "}
              <span className="text-cyan-400">{"circuit"}</span>
              {"={myCircuit}"}
              {"\n/>"}
            </pre>
          </div>
        </Section>

        {/* Row 1.5: Drill-down showcase */}
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

        {/* Row 2: complex demo */}
        <Section>
          <SectionHeading
title="Scale to real-world complexity"
            description="A full RISC-V CPU running compiled C, C++, and Rust — hundreds of nodes, all in your browser."
          />
          <div className="grid grid-cols-1 gap-4">
            <ComplexDemoCard
              title="RV32I CPU Debugger"
              subtitle="~300 lines of TypeScript"
              description="Write C, C++, or Rust, compile it with the GCC RISC-V toolchain, and watch it execute instruction by instruction on a real 5-stage pipelined RISC-V CPU."
              href="/learn/rv32i-cpu"
              accent="blue"
              preview={<RV32IDebuggerPreview />}
            />
          </div>
        </Section>

        {/* Row 3: Ethernet parser — full width */}
        <Section>
          <SectionHeading
title="Real protocols, simulated from gates"
            description="IEEE 802.3 Ethernet frame parsing — MAC addresses, EtherType, CRC-32, all running live."
          />
          <EthernetParserCard />
        </Section>

        {/* Row 4: Featured deep dives */}
        <Section>
          <SectionHeading
title="Interactive deep dives"
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

        {/* Row 5.5: Headless simulation */}
        <Section>
          <SectionHeading
title="Run headless — no browser needed"
            description="The same engine runs in Node.js, CI pipelines, and MCP tools at 20,000+ ticks/sec."
          />
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="flex-1 text-center text-[11px] text-muted-foreground font-mono">terminal</span>
            </div>
            <pre className="px-5 py-4 text-[12px] font-mono leading-relaxed overflow-x-auto">
<span className="text-muted-foreground">{"$ "}</span><span className="text-foreground">{"npx @simten/core simulate rv32i-board.circuit.ts --ticks 1000"}</span>{"\n"}
{"\n"}
<span className="text-muted-foreground/60">{"Compiling..."}</span><span className="text-muted-foreground">{" 2 circuits (RV32I_Core, RV32I_Board)"}</span>{"\n"}
<span className="text-muted-foreground/60">{"Elaborating..."}</span><span className="text-muted-foreground">{" 117 primitive nodes"}</span>{"\n"}
<span className="text-muted-foreground/60">{"Simulating..."}</span><span className="text-muted-foreground">{" 1,000 ticks in 52ms "}</span><span className="text-emerald-500 dark:text-emerald-400">{"(19,200 ticks/sec)"}</span>{"\n"}
{"\n"}
<span className="text-muted-foreground/60">{"UART output:"}</span>{"\n"}
<span className="text-emerald-500 dark:text-emerald-400">{"  Hello, World!"}</span>{"\n"}
{"\n"}
<span className="text-emerald-500 dark:text-emerald-400">{"✓"}</span><span className="text-muted-foreground">{" All assertions passed"}</span>{"\n"}
<span className="text-muted-foreground/60">{"  PC = 0x30 (halted at infinite loop)"}</span>
            </pre>
          </div>
        </Section>

        {/* Row 5.6: npm interop */}
        <Section>
          <SectionHeading
title="Import any npm package"
            description="Circuits are TypeScript. Use fast-check for property testing, D3 for visualization, or your own libraries to drive simulations."
          />
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="flex-1 text-center text-[11px] text-muted-foreground font-mono">verify-adder.test.ts</span>
            </div>
            <HighlightedCode
              code={`import { circuit, bit } from '@simten/core/circuit'
import { Xor, And } from '@simten/core/std'
import { simulate } from '@simten/core/sim'
import * as fc from 'fast-check'

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
})

// Property: sum + 2·carry always equals a + b
fc.assert(
  fc.property(fc.boolean(), fc.boolean(), (a, b) => {
    const sim = simulate(HalfAdder)
    sim.set({ a: a ? 1 : 0, b: b ? 1 : 0 })
    const result = sim.get('sum') + 2 * sim.get('carry')
    sim.dispose()
    return result === (a ? 1 : 0) + (b ? 1 : 0)
  })
)
// ✓ Passed 100 random inputs`}
              className="px-5 py-4 text-[12px] font-mono leading-relaxed overflow-x-auto m-0"
            />
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-3">No testbench language. No waveform files. Just TypeScript and whatever libraries you already know.</p>
        </Section>

        {/* Row 6: Build with AI */}
        <Section>
          <ClaudeCTA />
        </Section>

        {/* Row 7: Verilog Export */}
        <Section>
          <SectionHeading
title="Export to Verilog"
            description="Design in TypeScript. Export synthesisable Verilog. Verified cycle-by-cycle against Icarus Verilog."
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
          <p className="text-[11px] text-muted-foreground/60 mt-3">Any circuit you build exports to synthesisable Verilog — verified cycle-by-cycle against Icarus Verilog.</p>
        </Section>

        <div className="mt-28 md:mt-36 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <p className="text-[13px] text-muted-foreground/60">
            Or build circuits yourself — no Claude needed.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/editor"
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
      </div>

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
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40 ${
                isRunning
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-200"
                  : "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300"
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
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40 ${
                isRunning
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-200"
                  : "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300"
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
          to="/blog/snake-in-hardware"
          className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          Read post →
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
    nodes: { frame_in: Eth_FrameInput, enable: Constant, parser: Eth_FrameParser, crc: Eth_CRC32, proto: Eth_ProtocolDecoder, addr: Eth_AddrClassifier },
    nodeArgs: { enable: { value: 1 }, frame_in: { init: romFromBytes(frameBytes) } },
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
    <div className="rounded-lg border border-border overflow-hidden bg-card mt-4">
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


function ComplexDemoCard({
  title,
  subtitle,
  description,
  href,
  accent,
  snippet,
  image,
  imageAlt,
  preview,
}: {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  accent: "blue" | "violet";
  snippet?: string;
  /** Optional preview image (e.g. screenshot). Renders instead of `snippet`. */
  image?: string;
  imageAlt?: string;
  /** Optional rendered preview (HTML mockup). Wins over `image` and `snippet`. */
  preview?: React.ReactNode;
}) {
  const accentColor =
    accent === "blue" ? "text-blue-600 dark:text-blue-400/70" : "text-violet-600 dark:text-violet-400/70";
  const borderColor =
    accent === "blue" ? "border-blue-200 dark:border-blue-900/30" : "border-violet-200 dark:border-violet-900/30";
  const bgColor =
    accent === "blue" ? "from-blue-50 dark:from-blue-950/20" : "from-violet-50 dark:from-violet-950/20";

  const coloredSnippet = (snippet ?? "").split("\n").map((line, i) => {
    const isComment = line.trim().startsWith("//");
    const isCircuit = line.startsWith("circuit");
    const isNode = line.trim().startsWith("node");
    return (
      <div
        key={i}
        className={
          isComment
            ? "text-muted-foreground/40"
            : isCircuit
            ? accentColor
            : isNode
            ? "text-muted-foreground"
            : "text-muted-foreground/60"
        }
      >
        {line || "\u00A0"}
      </div>
    );
  });

  return (
    <div
      className={`flex flex-col rounded-lg border ${borderColor} overflow-hidden bg-gradient-to-br ${bgColor} to-card`}
    >
      {preview ? (
        <Link to={href} className="block bg-card overflow-hidden" style={{ height: 480 }}>
          {preview}
        </Link>
      ) : image ? (
        <Link to={href} className="block bg-[#0a0a0a]" style={{ height: 360 }}>
          <img
            src={image}
            alt={imageAlt ?? title}
            loading="lazy"
            className="h-full w-full object-cover object-left-top"
          />
        </Link>
      ) : (
        <div
          className="flex-1 px-5 pt-5 pb-3 font-mono text-[12px] leading-6"
          style={{ height: 240 }}
        >
          {coloredSnippet}
        </div>
      )}
      <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
            {subtitle}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>
        <Link
          to={href}
          className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          Open demo →
        </Link>
      </div>
    </div>
  );
}
