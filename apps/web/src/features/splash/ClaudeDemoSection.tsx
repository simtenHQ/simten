/**
 * Claude MCP Demo Section
 *
 * The scripted "Claude builds a circuit in your browser" showcase.
 * Previously lived inline in routes/index.tsx as the top-of-page hero.
 * Extracted so it can be relocated on the page and gated on scroll.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { CircuitEmbed, type CircuitEmbedHandle } from "@simten/embed";
import { circuit, bit } from "@simten/core/circuit";
import type { BuiltCircuit } from "@simten/core/circuit";
import { Xor, And, Or, Not, DFlipFlop } from "@simten/core/std";
import { HighlightedCode } from "@/components/HighlightedCode";
import { Container } from "@/components/Container";
import { CodeWithHovers } from "./CodeWithHovers";
import { FigletDemo, FIGLET_DEMO_CODE } from "./Hero";

// ============================================================================
// Demo circuits (self-contained — the gallery has its own copies of shared ones)
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

const Toggle = circuit('Toggle', {
  outputs: { q: bit, q_bar: bit },
  nodes: { dff: DFlipFlop(), inv: Not },
  connect: ({ outputs, nodes: { dff, inv } }) => [
    dff.q.to(inv.in, outputs.q),
    dff.q_bar.to(outputs.q_bar),
    inv.out.to(dff.d),
  ],
});

const GateFullAdder = circuit('FullAdder', {
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

// ============================================================================
// Script data
// ============================================================================

type TermLine = {
  type: "input" | "text" | "tool" | "result" | "blank";
  content: string;
  delay: number;
  typewriter?: boolean;
  typeSpeed?: number;
};

const DEMO_SCRIPT: TermLine[] = [
  {
    type: "input",
    content: "Build me a half adder",
    delay: 600,
    typewriter: true,
    typeSpeed: 35,
  },
  { type: "blank", content: "", delay: 400 },
  {
    type: "text",
    content:
      "I'll create a half adder circuit. XOR for the sum, AND for the carry.",
    delay: 300,
    typewriter: true,
    typeSpeed: 12,
  },
  { type: "blank", content: "", delay: 200 },
  { type: "tool", content: "write_circuit (simten)", delay: 100 },
  {
    type: "result",
    content: "Writing HalfAdder to simten.dev...",
    delay: 400,
  },
  { type: "result", content: "4 nodes, 6 connections, 0 errors", delay: 0 },
  { type: "blank", content: "", delay: 200 },
  { type: "tool", content: "simulate_circuit (simten)", delay: 100 },
  { type: "result", content: "Simulation ready", delay: 600 },
  { type: "blank", content: "", delay: 200 },
  {
    type: "text",
    content:
      "Your half adder is live. Toggle the switches to try all four input combinations — sum is XOR(a,b), carry is AND(a,b).",
    delay: 300,
    typewriter: true,
    typeSpeed: 12,
  },
];

type PromptOption = {
  label: string;
  circuit: BuiltCircuit;
  displayCode: string;
  script: TermLine[];
};

const PROMPT_OPTIONS: PromptOption[] = [
  {
    label: "Build a full adder",
    circuit: GateFullAdder,
    displayCode: `const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: {
    xor1: Xor,
    xor2: Xor,
    and1: And,
    and2: And,
    or1: Or,
  },
  connect: ({
    inputs,
    outputs,
    nodes: { xor1, xor2, and1, and2, or1 },
  }) => [
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
    script: [
      {
        type: "input",
        content: "Build a full adder",
        delay: 0,
        typewriter: true,
        typeSpeed: 30,
      },
      { type: "blank", content: "", delay: 400 },
      {
        type: "text",
        content:
          "A full adder adds three bits — a, b, and carry-in — producing sum and carry-outputs. Chain four of these and you have the ALU inside a CPU.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "write_circuit (simten)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing FullAdder to simten.dev...",
        delay: 400,
      },
      {
        type: "result",
        content: "5 nodes, 10 connections, 0 errors",
        delay: 0,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (simten)",
        delay: 100,
      },
      { type: "result", content: "Simulation ready", delay: 600 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "text",
        content:
          "Your full adder is live. Toggle switches to try all eight input combinations — carry-out lights when two or more inputs are high.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
    ],
  },
  {
    label: "Make a 2-bit binary counter",
    circuit: Counter2Bit,
    displayCode: `const Counter2Bit = circuit('Counter2Bit', {
  outputs: { bit0: bit, bit1: bit },
  nodes: {
    dff0: DFlipFlop(),
    dff1: DFlipFlop(),
    inv: Not,
    xor1: Xor,
  },
  connect: ({
    outputs,
    nodes: { dff0, dff1, inv, xor1 },
  }) => [
    dff0.q.to(inv.in, xor1.b, outputs.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, outputs.bit1),
    xor1.out.to(dff1.d),
  ],
});`,
    script: [
      {
        type: "input",
        content: "Make a 2-bit binary counter",
        delay: 0,
        typewriter: true,
        typeSpeed: 30,
      },
      { type: "blank", content: "", delay: 400 },
      {
        type: "text",
        content:
          "A synchronous 2-bit counter — two D flip-flops with toggle logic. Bit 0 flips every cycle, bit 1 flips when bit 0 is high. Counts 0, 1, 2, 3, repeat.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "write_circuit (simten)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Counter2Bit to simten.dev...",
        delay: 400,
      },
      { type: "result", content: "4 nodes, 8 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (simten)",
        delay: 100,
      },
      { type: "result", content: "Simulation ready", delay: 600 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "text",
        content:
          "Your counter is live. Click Tick to advance — the LEDs count in binary: 00 → 01 → 10 → 11 → 00.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
    ],
  },
  {
    label: "Make a toggle flip-flop",
    circuit: Toggle,
    displayCode: `const Toggle = circuit('Toggle', {
  outputs: { q: bit, q_bar: bit },
  nodes: { dff: DFlipFlop(), inv: Not },
  connect: ({
    outputs,
    nodes: { dff, inv },
  }) => [
    dff.q.to(inv.in, outputs.q),
    dff.q_bar.to(outputs.q_bar),
    inv.out.to(dff.d),
  ],
});`,
    script: [
      {
        type: "input",
        content: "Make a toggle flip-flop",
        delay: 0,
        typewriter: true,
        typeSpeed: 30,
      },
      { type: "blank", content: "", delay: 400 },
      {
        type: "text",
        content:
          "A DFlipFlop with inverted feedback — Q toggles on every rising clock edge.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "write_circuit (simten)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Toggle to simten.dev...",
        delay: 400,
      },
      { type: "result", content: "2 nodes, 4 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (simten)",
        delay: 100,
      },
      { type: "result", content: "Simulation ready", delay: 600 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "text",
        content:
          "Your toggle is live. Click the Tick button to advance the clock — Q flips on every rising edge.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
    ],
  },
  {
    label: "Build a 2-to-1 multiplexer",
    circuit: Mux2to1,
    displayCode: `const Mux2to1 = circuit('Mux2to1', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: {
    not1: Not,
    and1: And,
    and2: And,
    or1: Or,
  },
  connect: ({
    inputs,
    outputs,
    nodes: { not1, and1, and2, or1 },
  }) => [
    inputs.sel.to(not1.in, and2.b),
    inputs.a.to(and1.a),
    not1.out.to(and1.b),
    inputs.b.to(and2.a),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(outputs.out),
  ],
});`,
    script: [
      {
        type: "input",
        content: "Build a 2-to-1 multiplexer",
        delay: 0,
        typewriter: true,
        typeSpeed: 30,
      },
      { type: "blank", content: "", delay: 400 },
      {
        type: "text",
        content:
          "A mux selects between two inputs using a selector bit: out = (a AND NOT sel) OR (b AND sel).",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "write_circuit (simten)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Mux2to1 to simten.dev...",
        delay: 400,
      },
      { type: "result", content: "4 nodes, 7 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (simten)",
        delay: 100,
      },
      { type: "result", content: "Simulation ready", delay: 600 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "text",
        content:
          "Your multiplexer is live. Flip sel to switch which input drives the output.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
    ],
  },
];

// ============================================================================
// Typewriter hook
// ============================================================================

function useTypewriter(
  text: string,
  speed: number,
  startDelay: number,
  active: boolean,
) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  const prevText = useRef(text);
  useEffect(() => {
    if (text !== prevText.current) {
      prevText.current = text;
      if (!active) {
        setDisplayed("");
        setDone(false);
      }
    }
  }, [text, active]);

  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    setDone(false);

    const startTimer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, speed, startDelay, active]);

  return { displayed, done };
}

// Code highlighting is provided by @/components/HighlightedCode (sugar-high).

// ============================================================================
// Window chrome
// ============================================================================

function TerminalWindow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border border-[#30363d] ${
        className ?? ""
      }`}
    >
      <div className="flex-shrink-0 bg-[#161b22] px-4 h-11 flex items-center border-b border-[#30363d]">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="flex-1 text-center text-[12px] text-gray-500 font-mono">
          terminal
        </span>
        <div className="w-[52px]" />
      </div>
      <div className="flex-1 min-h-0 bg-[#0d1117] text-gray-200">{children}</div>
    </div>
  );
}

function BrowserWindow({
  children,
  className,
  showMcp,
}: {
  children: ReactNode;
  className?: string;
  showMcp?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border border-border ${
        className ?? ""
      }`}
    >
      <div className="flex-shrink-0 bg-muted px-4 h-11 flex items-center gap-3 border-b border-border">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex items-center bg-card rounded-full border border-border px-3 h-6 gap-2 min-w-0">
          <svg
            className="w-3 h-3 text-muted-foreground shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-[12px] text-muted-foreground font-mono truncate">
            simten.dev
          </span>
        </div>
        {showMcp && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-card/80 border border-border px-2.5 py-1 text-[11px] text-muted-foreground shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            MCP connected
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 bg-card text-foreground">{children}</div>
    </div>
  );
}

// ============================================================================
// Copy-to-clipboard command line
// ============================================================================

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div className="inline-flex items-center gap-3 bg-muted rounded-lg border border-border px-4 py-3 group max-w-full overflow-x-auto">
      <span className="text-muted-foreground/60 font-mono text-sm select-none">$</span>
      <span className="font-mono text-sm text-foreground">{command}</span>
      <button
        onClick={copy}
        className="ml-2 text-muted-foreground/60 hover:text-foreground/80 transition-colors shrink-0"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Terminal line
// ============================================================================

function TerminalLine({
  line,
  onDone,
}: {
  line: TermLine;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const signalled = useRef(false);

  const isTypewriter = line.typewriter ?? false;
  const { displayed, done } = useTypewriter(
    line.content,
    line.typeSpeed ?? 12,
    0,
    isTypewriter,
  );

  useEffect(() => {
    if (signalled.current) return;
    if (!isTypewriter || done) {
      signalled.current = true;
      onDoneRef.current();
    }
  }, [isTypewriter, done]);

  if (line.type === "blank") return <div className="h-3" />;

  const text = line.typewriter ? displayed : line.content;
  const showCursor = line.typewriter && !done;
  const cursor = (
    <span className="inline-block w-[7px] h-[15px] bg-gray-400 ml-[1px] animate-[pulse_1s_steps(1)_infinite] align-text-bottom" />
  );

  if (line.type === "input") {
    return (
      <div className="flex items-start gap-2">
        <span className="text-gray-200 select-none shrink-0">&gt;</span>
        <span className="text-gray-200">
          {text}
          {showCursor && cursor}
        </span>
      </div>
    );
  }

  if (line.type === "tool") {
    return (
      <div className="flex items-start gap-2 text-gray-500">
        <span className="text-blue-400 shrink-0">{">"}</span>
        <span>{text}</span>
      </div>
    );
  }

  if (line.type === "result") {
    return <div className="pl-5 text-gray-600">{text}</div>;
  }

  return (
    <div className="text-gray-300">
      {text}
      {showCursor && cursor}
    </div>
  );
}

// ============================================================================
// Scripted terminal
// ============================================================================

const noop = () => {};

function ScriptedTerminal({
  onCodeStage,
  onComplete,
  extraLines,
  active,
}: {
  onCodeStage: () => void;
  onComplete: () => void;
  extraLines: TermLine[];
  active: boolean;
}) {
  const allLines = useRef(DEMO_SCRIPT);
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentDone, setCurrentDone] = useState(false);
  const onCodeStageRef = useRef(onCodeStage);
  onCodeStageRef.current = onCodeStage;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const prevExtraLen = useRef(0);

  useEffect(() => {
    if (extraLines.length > prevExtraLen.current) {
      const newLines = extraLines.slice(prevExtraLen.current);
      allLines.current = [...allLines.current, ...newLines];
      prevExtraLen.current = extraLines.length;
      const firstNew = allLines.current.length - newLines.length;
      const delay = newLines[0].delay;
      setTimeout(() => {
        setVisibleCount(firstNew + 1);
        setCurrentDone(false);
      }, delay || 100);
    }
  }, [extraLines]);

  useEffect(() => {
    if (!active) return;
    if (visibleCount > 0) return;
    const t = setTimeout(() => setVisibleCount(1), DEMO_SCRIPT[0].delay);
    return () => clearTimeout(t);
  }, [active, visibleCount]);

  useEffect(() => {
    if (!currentDone) return;
    if (visibleCount >= allLines.current.length) {
      onCompleteRef.current();
      return;
    }

    const nextLine = allLines.current[visibleCount];
    const t = setTimeout(() => {
      setVisibleCount((c) => c + 1);
      setCurrentDone(false);
    }, nextLine.delay);

    return () => clearTimeout(t);
  }, [currentDone, visibleCount]);

  useEffect(() => {
    if (visibleCount === 0) return;
    const lastShown = allLines.current[visibleCount - 1];
    if (
      lastShown?.type === "tool" &&
      lastShown.content.includes("write_circuit")
    ) {
      onCodeStageRef.current();
    }
  }, [visibleCount]);

  const handleLineDone = useCallback(() => {
    setCurrentDone(true);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only scroll once there's content to scroll to. On initial mount
    // (visibleCount = 0) we don't want any scroll at all, otherwise the
    // page auto-scrolls down to this section just because the ref exists
    // below the fold.
    if (visibleCount === 0) return;

    // Walk up to find the nearest scrollable ancestor (the terminal's own
    // overflow-y container) and scroll only it — never the page. Using
    // scrollIntoView would cascade through every scrollable ancestor and
    // drag the viewport along when this section is off-screen.
    const el = bottomRef.current;
    if (!el) return;
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const overflowY = getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        parent.scrollTop = parent.scrollHeight;
        return;
      }
      parent = parent.parentElement;
    }
  }, [visibleCount]);

  return (
    <div className="font-mono text-[13px] leading-relaxed space-y-[2px]">
      {allLines.current.slice(0, visibleCount).map((line, i) => (
        <TerminalLine
          key={i}
          line={line}
          onDone={i === visibleCount - 1 ? handleLineDone : noop}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ============================================================================
// Hero browser window (right pane: code + live circuit)
// ============================================================================

interface HeroBrowserWindowHandle {
  startTyping: () => void;
  pickPrompt: (option: PromptOption) => void;
  swapCircuit: (demo: HeroDemo) => void;
}

interface HeroDemo {
  key: string;
  label: string;
  circuit: BuiltCircuit;
  displayCode: string;
}

const HALF_ADDER_DISPLAY = `const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({
    inputs,
    outputs,
    nodes: { xor1, and1 },
  }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});`;

// Toggleable demos surfaced once the canvas has fully revealed.
// HalfAdder is the default (matches the scripted intro); the rest let the
// user explore the same set of small primitives the PROMPT_OPTIONS picker
// used to drive, now reachable via side arrows + pills below the hero.
const HERO_DEMOS: HeroDemo[] = [
  {
    key: "half-adder",
    label: "Half adder",
    circuit: HalfAdder,
    displayCode: HALF_ADDER_DISPLAY,
  },
  // Figlet → ROM: the showcase from further down the page, lifted up so users
  // see the "npm packages compile straight into hardware" pitch right in the
  // hero. Self-driving (auto-runs once selected — see effect in HeroBrowserWindow).
  // Code is intentionally wider than the 340px panel so the wider definitions
  // (factory calls + the npm imports) read naturally — the panel scrolls.
  {
    key: "figlet",
    label: "Figlet → ROM",
    circuit: FigletDemo,
    displayCode: FIGLET_DEMO_CODE,
  },
  ...PROMPT_OPTIONS.map((opt) => ({
    key: opt.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label: opt.label
      .replace(/^Build (a |an )?/i, "")
      .replace(/^Make (a |an )?/i, "")
      .replace(/^./, (c) => c.toUpperCase()),
    circuit: opt.circuit,
    displayCode: opt.displayCode,
  })),
];

const HeroBrowserWindow = forwardRef<
  HeroBrowserWindowHandle,
  { canvasReady?: boolean }
>(
  function HeroBrowserWindow({ canvasReady = false }, ref) {
    const [codeTyping, setCodeTyping] = useState(false);
    const [showCircuit, setShowCircuit] = useState(false);
    const [targetCircuit, setTargetCircuit] = useState<BuiltCircuit>(HalfAdder);
    const [displayCode, setDisplayCode] = useState(HALF_ADDER_DISPLAY);
    // Stable identity per demo so CircuitEmbed remounts cleanly when the
    // user cycles through HERO_DEMOS post-reveal (React Flow doesn't
    // gracefully swap a different circuit on the same instance).
    const [embedKey, setEmbedKey] = useState("half-adder");
    const embedRef = useRef<CircuitEmbedHandle>(null);

    // Figlet streams bytes through a Register+Adder feedback loop, so it
    // only does anything once the clock is ticking. Auto-run whenever the
    // figlet demo is the selected one; stop when the user switches away.
    // setTimeout(0) gives the new embed instance (remounted via key change)
    // a tick to attach its imperative handle before we call into it.
    useEffect(() => {
      if (embedKey !== "figlet") return;
      const id = setTimeout(() => embedRef.current?.startAutoRun(5), 0);
      return () => {
        clearTimeout(id);
        embedRef.current?.stopAutoRun();
      };
    }, [embedKey]);

    const codeTw = useTypewriter(displayCode, 12, 0, codeTyping);

    useEffect(() => {
      if (codeTyping && codeTw.done) {
        setShowCircuit(true);
        setCodeTyping(false);
      }
    }, [codeTyping, codeTw.done]);

    useImperativeHandle(ref, () => ({
      startTyping() { setCodeTyping(true); },
      pickPrompt(option: PromptOption) {
        setTargetCircuit(option.circuit);
        setDisplayCode(option.displayCode);
        setShowCircuit(false);
      },
      swapCircuit(demo: HeroDemo) {
        setTargetCircuit(demo.circuit);
        setDisplayCode(demo.displayCode);
        setEmbedKey(demo.key);
      },
    }), []);

    // CircuitEmbed only mounts once the parent has confirmed the
    // column-collapse animation finished (canvasReady=true), so React
    // Flow measures at the final expanded width on its very first
    // render instead of reflowing during the animation. The fade-in
    // softens the discrete mount moment so it reads as a reveal rather
    // than a pop.
    const mountCanvas = showCircuit && canvasReady;

    return (
      <BrowserWindow className="flex-1" showMcp={codeTyping || showCircuit}>
        <div className="flex h-full">
          {/* Widen on larger screens so full-width comments (~63 chars) stay
              legible without horizontal clipping; the canvas (flex-1) absorbs
              the difference where there's room. */}
          <div className="w-[360px] lg:w-[440px] xl:w-[500px] shrink-0 border-r border-border overflow-auto">
            {codeTyping ? (
              <HighlightedCode
                code={codeTw.displayed}
                className="text-[12px] font-mono leading-relaxed whitespace-pre py-3 px-4 m-0"
                trailing={
                  <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
                }
              />
            ) : showCircuit ? (
              <CodeWithHovers
                code={displayCode}
                className="text-[12px] font-mono leading-relaxed whitespace-pre py-3 px-4 m-0"
                enabled={canvasReady}
              />
            ) : (
              <div className="text-[12px] font-mono py-3 px-4">
                <span className="text-muted-foreground/40 italic text-[11px]">
                  Waiting for circuit...
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 relative">
              {mountCanvas ? (
                <div key={embedKey} className="h-full animate-in fade-in duration-500">
                  {/* forkSource hands the embed the human-readable source so
                      the Fork button opens the editor with the nice version,
                      not the IR-derived one (which for figlet would inline
                      romFromBytes(...) as a 256-entry literal byte map). */}
                  <CircuitEmbed
                    ref={embedRef}
                    circuit={targetCircuit}
                    forkSource={displayCode}
                    height="100%"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm font-mono">
                  {codeTyping || showCircuit ? "Compiling..." : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      </BrowserWindow>
    );
  }
);

// ============================================================================
// The exported section component
// ============================================================================

export interface ClaudeDemoSectionProps {
  /** Called once when the scripted demo finishes playing. */
  onComplete?: () => void;
  /**
   * When true, the scripted demo auto-plays immediately on mount regardless
   * of scroll position. Defaults to false — the demo waits until its desktop
   * container scrolls into view before starting. Useful for placing the
   * component further down the page without triggering a hidden animation.
   */
  autoPlay?: boolean;
}

export function ClaudeDemoSection({
  onComplete,
  autoPlay = false,
}: ClaudeDemoSectionProps) {
  const [demoComplete, setDemoComplete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Gates the canvas mount inside HeroBrowserWindow: stays false until
  // the column-collapse animation has finished, so CircuitEmbed measures
  // at its final (expanded) width on first render rather than mounting
  // at the narrow build-phase width and then reflowing partway through
  // the collapse animation.
  const [canvasReady, setCanvasReady] = useState(false);
  // The picker UI ("Try another demo …") was removed; ScriptedTerminal
  // still needs an `extraLines` prop but the section never appends to it,
  // so a stable empty array is fine.
  const extraLines: TermLine[] = [];

  // Reading buffer: after the typewriter finishes, hold the fully-typed
  // terminal visible for a beat so the user can actually finish reading
  // the last lines before the column slides away. Then the column
  // collapses (COLLAPSE_MS), then the canvas mounts (post-animation).
  const READING_BUFFER_MS = 800;
  // Duration of the terminal-column collapse animation. Used both as
  // the CSS transition duration on the grid columns and as the timeout
  // between expanded=true firing and canvasReady=true firing. Decoupled
  // from the terminal's text fade-out (duration-500 on TerminalWindow's
  // opacity transition) — the text fades quickly while the column itself
  // slides more deliberately, so the reader's attention is freed from
  // the transcript before the column finishes giving its space to the
  // canvas.
  const COLLAPSE_MS = 1200;

  // Scroll-into-view gating for the scripted terminal animation.
  // Starts true if autoPlay was requested, otherwise waits for IO.
  const [inView, setInView] = useState(autoPlay);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(autoPlay);

  useEffect(() => {
    if (hasPlayedRef.current) return;
    if (typeof window === "undefined") return;

    // Reduced-motion users: activate immediately so content isn't hidden,
    // but the typewriter still runs (it's short). Simpler than building a
    // separate "static final state" render path.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      hasPlayedRef.current = true;
      setInView(true);
      return;
    }

    // Old browsers without IntersectionObserver: fall back to auto-play.
    if (typeof IntersectionObserver === "undefined") {
      hasPlayedRef.current = true;
      setInView(true);
      return;
    }

    const el = desktopContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            hasPlayedRef.current = true;
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heroRef = useRef<HeroBrowserWindowHandle>(null);

  // Index into HERO_DEMOS — HalfAdder (index 0) is what the scripted intro
  // builds, so we start there. Cycling fires swapCircuit on the hero handle.
  const [demoIndex, setDemoIndex] = useState(0);
  const cycleDemo = useCallback((delta: number) => {
    setDemoIndex((prev) => {
      const next = (prev + delta + HERO_DEMOS.length) % HERO_DEMOS.length;
      heroRef.current?.swapCircuit(HERO_DEMOS[next]);
      return next;
    });
  }, []);
  const pickDemo = useCallback((index: number) => {
    setDemoIndex(index);
    heroRef.current?.swapCircuit(HERO_DEMOS[index]);
  }, []);

  // Keyboard arrows cycle through demos once the picker is live. Mirrors
  // Hero.tsx's behaviour so the affordance is consistent across the page.
  useEffect(() => {
    if (!canvasReady) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight") cycleDemo(1);
      else if (e.key === "ArrowLeft") cycleDemo(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvasReady, cycleDemo]);

  const handleCodeStage = useCallback(() => {
    heroRef.current?.startTyping();
  }, []);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const handleComplete = useCallback(() => {
    setDemoComplete(true);
    onCompleteRef.current?.();
  }, []);

  // Post-completion sequence:
  //   typewriter done → wait READING_BUFFER_MS so the user can read
  //   → trigger column-collapse animation (expanded=true, CSS handles
  //     the transition over COLLAPSE_MS)
  //   → after the animation completes, mount the canvas (canvasReady=true)
  //     so CircuitEmbed measures at its final width on first render.
  // Both timers cancel on unmount or when demoComplete resets (e.g.
  // user clicks "Try another demo" mid-run).
  useEffect(() => {
    if (!demoComplete) return;
    const expandT = setTimeout(() => setExpanded(true), READING_BUFFER_MS);
    const mountT = setTimeout(
      () => setCanvasReady(true),
      READING_BUFFER_MS + COLLAPSE_MS,
    );
    return () => {
      clearTimeout(expandT);
      clearTimeout(mountT);
    };
  }, [demoComplete]);

  return (
    <section className="hidden md:block pt-10 pb-16">
      <Container>
        {/* Section label */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] text-foreground">
            Describe hardware. Claude builds it. Test it like software.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl">
            A TypeScript HDL where any npm package is your testbench. Drive circuits with real firmware, watch them run cycle-by-cycle, and synthesize to Verilog.
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            {/* Primary action — keeps the hero framed around "this is a
                hardware framework", not "this is an MCP install". The editor
                is a secondary, zero-friction "try it now" path; the MCP
                CopyCommand sits last so power users still see it without it
                visually dominating. */}
            <Link
              to="/docs/$"
              params={{ _splat: "" }}
              className="inline-flex items-center rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors px-4 py-3 text-sm font-medium"
            >
              Learn more →
            </Link>
            <Link
              to="/circuit"
              className="inline-flex items-center rounded-lg border border-border hover:bg-muted transition-colors px-4 py-3 text-sm font-medium text-foreground"
            >
              Open the editor →
            </Link>
            <CopyCommand command="claude mcp add simten npx @simten/mcp" />
          </div>
        </div>

        <div className="relative">
        <div
          ref={desktopContainerRef}
          className="h-[460px] grid min-h-0 ease-in-out"
          style={{
            // Use matching fr units on both endpoints so CSS can actually
            // interpolate. Mixing units (% on one side, fr on the other)
            // makes the browser snap-to instead of animate.
            gridTemplateColumns: expanded ? "0fr 100fr" : "38fr 62fr",
            // Gap also collapses to 0 in expanded state — otherwise the
            // canvas column sits 16px right of where the rest of the
            // hero content's left edge is, misaligning with the rest of
            // the page after the terminal slides away.
            columnGap: expanded ? "0" : "1rem",
            transitionProperty: "grid-template-columns, column-gap",
            transitionDuration: `${COLLAPSE_MS}ms`,
          }}
        >
          <TerminalWindow
            className={`min-w-0 transition-opacity duration-300 ${
              expanded ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <ScriptedTerminal
                  onCodeStage={handleCodeStage}
                  onComplete={handleComplete}
                  extraLines={extraLines}
                  active={inView}
                />
              </div>

            </div>
          </TerminalWindow>

          <HeroBrowserWindow ref={heroRef} canvasReady={canvasReady} />

          {/* Side cycle arrows — pinned to the canvas's vertical centre and
              tucked against the left/right edges. Hero is full-width post-
              collapse, so the arrows naturally land far apart, hinting at
              side-to-side navigation. Pointer-events stay off the wrapper
              so the canvas underneath is interactive; only the buttons
              themselves capture clicks. */}
          {canvasReady && (
            <div className="pointer-events-none absolute inset-y-0 -left-14 -right-14 z-10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => cycleDemo(-1)}
                aria-label="Previous circuit"
                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition-all hover:bg-muted hover:text-foreground hover:border-foreground/40 hover:scale-105 animate-in fade-in slide-in-from-left-2 duration-500"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => cycleDemo(1)}
                aria-label="Next circuit"
                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition-all hover:bg-muted hover:text-foreground hover:border-foreground/40 hover:scale-105 animate-in fade-in slide-in-from-right-2 duration-500"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Demo picker pills — animates in below the hero once the canvas
            is live, mirroring the figlet demo's picker further down. */}
        {canvasReady && (
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-500">
            {HERO_DEMOS.map((d, i) => (
              <button
                key={d.key}
                onClick={() => pickDemo(i)}
                className={`text-[13px] px-3.5 py-1.5 rounded-full border transition-colors ${
                  i === demoIndex
                    ? "border-foreground/30 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50"
                }`}
              >
                {d.label}
              </button>
            ))}
            <span className="text-[13px] text-muted-foreground ml-3 font-mono">
              ← → to cycle
            </span>
          </div>
        )}
      </Container>
    </section>
  );
}
