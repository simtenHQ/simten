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
import { CircuitEmbed } from "@turing-incomplete/embed";
import { circuit, bit } from "@turing-incomplete/core/circuit";
import type { BuiltCircuit } from "@turing-incomplete/core/circuit";
import { Xor, And, Or, Not, DFlipFlop } from "@turing-incomplete/core/std";
import { Logo } from "@/components/Logo";

// ============================================================================
// Demo circuits (self-contained — the gallery has its own copies of shared ones)
// ============================================================================

const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
});

const Toggle = circuit('Toggle', {
  out: { q: bit, q_bar: bit },
  nodes: { dff: DFlipFlop, inv: Not },
  connect: ({ out, dff, inv }) => [
    dff.q.to(inv.in, out.q),
    dff.q_bar.to(out.q_bar),
    inv.out.to(dff.d),
  ],
});

const GateFullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { xor1: Xor, xor2: Xor, and1: And, and2: And, or1: Or },
  connect: ({ in: inp, out, xor1, xor2, and1, and2, or1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(xor2.a, and2.a),
    inp.cin.to(xor2.b, and2.b),
    xor2.out.to(out.sum),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(out.cout),
  ],
});

const Counter2Bit = circuit('Counter2Bit', {
  out: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ out, dff0, dff1, inv, xor1 }) => [
    dff0.q.to(inv.in, xor1.b, out.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, out.bit1),
    xor1.out.to(dff1.d),
  ],
});

const Mux2to1 = circuit('Mux2to1', {
  in: { a: bit, b: bit, sel: bit },
  out: { out: bit },
  nodes: { not1: Not, and1: And, and2: And, or1: Or },
  connect: ({ in: inp, out, not1, and1, and2, or1 }) => [
    inp.sel.to(not1.in, and2.b),
    inp.a.to(and1.a),
    not1.out.to(and1.b),
    inp.b.to(and2.a),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(out.out),
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
  { type: "tool", content: "write_circuit (turing-incomplete)", delay: 100 },
  {
    type: "result",
    content: "Writing HalfAdder to turingincomplete.com...",
    delay: 400,
  },
  { type: "result", content: "4 nodes, 6 connections, 0 errors", delay: 0 },
  { type: "blank", content: "", delay: 200 },
  { type: "tool", content: "simulate_circuit (turing-incomplete)", delay: 100 },
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
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { xor1: Xor, xor2: Xor, and1: And, and2: And, or1: Or },
  connect: ({ in: inp, out, xor1, xor2, and1, and2, or1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(xor2.a, and2.a),
    inp.cin.to(xor2.b, and2.b),
    xor2.out.to(out.sum),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(out.cout),
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
          "A full adder adds three bits — a, b, and carry-in — producing sum and carry-out. Chain four of these and you have the ALU inside a CPU.",
        delay: 300,
        typewriter: true,
        typeSpeed: 12,
      },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "write_circuit (turing-incomplete)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing FullAdder to turingincomplete.com...",
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
        content: "simulate_circuit (turing-incomplete)",
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
  out: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ out, dff0, dff1, inv, xor1 }) => [
    dff0.q.to(inv.in, xor1.b, out.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, out.bit1),
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
        content: "write_circuit (turing-incomplete)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Counter2Bit to turingincomplete.com...",
        delay: 400,
      },
      { type: "result", content: "4 nodes, 8 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (turing-incomplete)",
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
  out: { q: bit, q_bar: bit },
  nodes: { dff: DFlipFlop, inv: Not },
  connect: ({ out, dff, inv }) => [
    dff.q.to(inv.in, out.q),
    dff.q_bar.to(out.q_bar),
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
        content: "write_circuit (turing-incomplete)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Toggle to turingincomplete.com...",
        delay: 400,
      },
      { type: "result", content: "2 nodes, 4 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (turing-incomplete)",
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
  in: { a: bit, b: bit, sel: bit },
  out: { out: bit },
  nodes: { not1: Not, and1: And, and2: And, or1: Or },
  connect: ({ in: inp, out, not1, and1, and2, or1 }) => [
    inp.sel.to(not1.in, and2.b),
    inp.a.to(and1.a),
    not1.out.to(and1.b),
    inp.b.to(and2.a),
    and1.out.to(or1.a),
    and2.out.to(or1.b),
    or1.out.to(out.out),
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
        content: "write_circuit (turing-incomplete)",
        delay: 100,
      },
      {
        type: "result",
        content: "Writing Mux2to1 to turingincomplete.com...",
        delay: 400,
      },
      { type: "result", content: "4 nodes, 7 connections, 0 errors", delay: 0 },
      { type: "blank", content: "", delay: 200 },
      {
        type: "tool",
        content: "simulate_circuit (turing-incomplete)",
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

// ============================================================================
// Circuit code syntax highlighting
// ============================================================================

function highlightCode(code: string): ReactNode[] {
  const KW = "text-[#0000ff] dark:text-[#569cd6] font-bold";
  const COMMENT = "text-[#008000] dark:text-[#6a9955] italic";
  const TYPE = "text-[#267f99] dark:text-[#4ec9b0]";
  const COMPONENT = "text-[#267f99] dark:text-[#4ec9b0]";
  const NUM = "text-[#098658] dark:text-[#b5cea8]";

  const KEYWORD_RE = /^(circuit|input|output|clock|state|impl|node|connect|on)\b/;

  return code.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    const indent = line.slice(0, line.length - trimmed.length);

    if (trimmed.startsWith("//")) {
      return <div key={i}>{indent}<span className={COMMENT}>{trimmed}</span></div>;
    }

    const tokens: ReactNode[] = [];
    let rest = trimmed;
    let k = 0;

    const eat = (pattern: RegExp, cls?: string) => {
      const m = rest.match(pattern);
      if (!m) return false;
      tokens.push(cls ? <span key={k++} className={cls}>{m[0]}</span> : <span key={k++}>{m[0]}</span>);
      rest = rest.slice(m[0].length);
      return true;
    };

    while (rest.length > 0) {
      if (eat(KEYWORD_RE, KW)) continue;
      if (eat(/^->/, KW)) continue;
      if (eat(/^(Bit|Bus\[\d+\])/, TYPE)) continue;
      if (eat(/^:\s*/, "text-muted-foreground")) {
        eat(/^[A-Z]\w*/, COMPONENT);
        eat(/^\([^)]*\)/, "text-muted-foreground");
        continue;
      }
      if (eat(/^\d+/, NUM)) continue;
      if (eat(/^[{}()]/, "text-muted-foreground/60")) continue;
      if (eat(/^\s+/)) continue;
      if (eat(/^[^\s{}()]+/)) continue;
    }

    return <div key={i}>{indent}{tokens}</div>;
  });
}

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
            turingincomplete.com
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
}

const HALF_ADDER_DISPLAY = `const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
});`;

const HeroBrowserWindow = forwardRef<HeroBrowserWindowHandle, {}>(
  function HeroBrowserWindow(_, ref) {
    const [codeTyping, setCodeTyping] = useState(false);
    const [showCircuit, setShowCircuit] = useState(false);
    const [targetCircuit, setTargetCircuit] = useState<BuiltCircuit>(HalfAdder);
    const [displayCode, setDisplayCode] = useState(HALF_ADDER_DISPLAY);

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
    }), []);

    return (
      <BrowserWindow className="flex-1" showMcp={codeTyping || showCircuit}>
        <div className="flex h-full">
          <div className="w-[250px] shrink-0 border-r border-border overflow-y-auto">
            <pre className="text-[12px] font-mono text-foreground/70 leading-relaxed whitespace-pre-wrap py-3 px-4 mx-auto">
              {codeTyping ? (
                <>
                  {highlightCode(codeTw.displayed)}
                  <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
                </>
              ) : showCircuit ? (
                highlightCode(displayCode)
              ) : (
                <span className="text-muted-foreground/40 italic text-[11px]">
                  Waiting for circuit...
                </span>
              )}
            </pre>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 relative">
              {showCircuit ? (
                <CircuitEmbed circuit={targetCircuit} height="100%" />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm font-mono">
                  {codeTyping ? "Compiling..." : ""}
                </div>
              )}
            </div>
            {showCircuit && (
              <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/60">
                  Click switches to interact
                </span>
                <Link
                  to="/editor"
                  className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  Open in full editor
                </Link>
              </div>
            )}
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
   * When false, the scripted terminal does not auto-play. Used to gate
   * the animation on scroll-into-view via IntersectionObserver.
   * Defaults to true for backwards-compatible "auto-play on mount" behavior.
   */
  active?: boolean;
}

export function ClaudeDemoSection({
  onComplete,
  active = true,
}: ClaudeDemoSectionProps) {
  const [demoComplete, setDemoComplete] = useState(false);
  const [extraLines, setExtraLines] = useState<TermLine[]>([]);
  const [pickedPrompt, setPickedPrompt] = useState(false);

  const heroRef = useRef<HeroBrowserWindowHandle>(null);

  const handleCodeStage = useCallback(() => {
    heroRef.current?.startTyping();
  }, []);

  const handlePickPrompt = useCallback((option: PromptOption) => {
    setPickedPrompt(true);
    setDemoComplete(false);
    heroRef.current?.pickPrompt(option);
    const separator: TermLine = { type: "blank", content: "", delay: 300 };
    setExtraLines([separator, ...option.script]);
  }, []);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const handleComplete = useCallback(() => {
    setDemoComplete(true);
    onCompleteRef.current?.();
  }, []);

  return (
    <>
      {/* Mobile: compact header + tagline + install command */}
      <div className="md:hidden">
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22} className="text-foreground/80 shrink-0" />
            <span className="font-semibold text-[14px] tracking-tight text-foreground/80">
              Turing Incomplete
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/learn" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Learn</Link>
            <Link to="/blog" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Blog</Link>
            <Link to="/challenges" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Challenges</Link>
            <Link to="/editor" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Editor</Link>
            <Link to="/docs/$" params={{ _splat: "" }} className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Docs</Link>
          </div>
        </div>
        <div className="px-5 pb-6 flex flex-col items-center text-center gap-4">
          <p className="text-sm text-muted-foreground max-w-xs">
            Live hardware simulations you can explore, build, and embed.
          </p>
          <CopyCommand command="claude mcp add turing-incomplete npx @turing-incomplete/mcp" />
        </div>
      </div>

      {/* Desktop: full-screen two-window demo */}
      <div className="hidden md:flex h-[calc(100vh-140px)] flex-col overflow-hidden relative">
        <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={28} className="text-foreground/80 shrink-0" />
            <div>
              <div className="font-semibold text-[15px] tracking-tight text-foreground/80">
                Turing Incomplete
              </div>
              <div className="text-[11px] text-muted-foreground/60">
                Live hardware simulations you can explore, build, and export to Verilog
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/charlesharris/turing-incomplete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <Link to="/learn" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Learn</Link>
            <Link to="/blog" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Blog</Link>
            <Link to="/challenges" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Challenges</Link>
            <Link to="/editor" className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Editor</Link>
            <Link to="/docs/$" params={{ _splat: "" }} className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs">Docs</Link>
          </div>
        </div>

        <div className="flex flex-1 gap-4 px-5 pb-5 min-h-0">
          <TerminalWindow className="w-[38%] flex-shrink-0">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <ScriptedTerminal
                  onCodeStage={handleCodeStage}
                  onComplete={handleComplete}
                  extraLines={extraLines}
                  active={active}
                />
              </div>

              {demoComplete && (
                <div className="flex-shrink-0 border-t border-[#30363d] px-5 py-4 space-y-3 animate-in fade-in duration-500">
                  {!pickedPrompt && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-mono text-[13px]">
                        <span className="text-gray-200">&gt;</span>
                        <span className="text-gray-600">
                          Try another demo...
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 pl-5">
                        {PROMPT_OPTIONS.map((option) => (
                          <button
                            key={option.label}
                            onClick={() => handlePickPrompt(option)}
                            className="text-left text-[13px] font-mono text-blue-400 hover:text-blue-300 hover:bg-[#161b22] rounded px-2 py-1.5 -mx-2 transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TerminalWindow>

          <HeroBrowserWindow ref={heroRef} />
        </div>
      </div>
    </>
  );
}
