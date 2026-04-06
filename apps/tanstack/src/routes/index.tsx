import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCircuitSimulator, CircuitEmbed } from "@turing-incomplete/embed";
import { Logo } from "@/components/Logo";
import { ClaudeCTA } from "@/features/splash/ClaudeCTA";
import { useSnakeSimulator } from "@/features/blog/snake-in-hardware/useSnakeSimulator";

// ============================================================================
// Demo data
// ============================================================================

const DEMO_DSL = `const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})`;


// --- Toggle (DFlipFlop with NOT feedback) ---

const TOGGLE_DSL = `const Toggle = circuit('Toggle', {
  out: { q: bit, q_bar: bit },
  nodes: { dff: DFlipFlop, inv: Not },
  connect: ({ out, dff, inv }) => [
    dff.q.to(inv.in, out.q),
    dff.q_bar.to(out.q_bar),
    inv.out.to(dff.d),
  ],
})`;


// --- Composite Full Adder (built from Half Adders — for drill-down showcase) ---

const DRILLDOWN_DSL = `const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})

const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a), inp.b.to(ha1.b),
    ha1.sum.to(ha2.a), inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a), ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ],
})`;

// --- 4-bit Shift Register (for time-travel showcase) ---

const SHIFT_REGISTER_DSL = `const ShiftRegister4 = circuit('ShiftRegister4', {
  in: { din: bit },
  out: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
  connect: ({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
    inp.din.to(ff0.d),
    ff0.q.to(ff1.d, out.q0),
    ff1.q.to(ff2.d, out.q1),
    ff2.q.to(ff3.d, out.q2),
    ff3.q.to(out.q3),
  ],
})`;

const FULL_ADDER_DSL = `const FullAdder = circuit('FullAdder', {
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
})`;


// --- 2-bit Counter ---

const COUNTER_DSL = `const Counter2Bit = circuit('Counter2Bit', {
  out: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ out, dff0, dff1, inv, xor1 }) => [
    dff0.q.to(inv.in, xor1.b, out.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, out.bit1),
    xor1.out.to(dff1.d),
  ],
})`;


// --- 2-to-1 Mux ---

const MUX_DSL = `const Mux2to1 = circuit('Mux2to1', {
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
})`;


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
  dsl: string;
  script: TermLine[];
};

const PROMPT_OPTIONS: PromptOption[] = [
  {
    label: "Build a full adder",
    dsl: FULL_ADDER_DSL,
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
    dsl: COUNTER_DSL,
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
    dsl: TOGGLE_DSL,
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
    dsl: MUX_DSL,
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

  // Reset when text changes while inactive (prep for next activation)
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
// DSL syntax highlighting
// ============================================================================

/** Lightweight DSL syntax highlighter — matches the Monaco dsl-light/dsl-dark themes */
function highlightCode(code: string): React.ReactNode[] {
  // Monaco uses a single "keyword" token (blue, bold) for all DSL keywords
  const KW = "text-[#0000ff] dark:text-[#569cd6] font-bold";
  // Comments
  const COMMENT = "text-[#008000] dark:text-[#6a9955] italic";
  // Strings / types
  const TYPE = "text-[#267f99] dark:text-[#4ec9b0]";
  // Component refs after ":"
  const COMPONENT = "text-[#267f99] dark:text-[#4ec9b0]";
  // Numbers
  const NUM = "text-[#098658] dark:text-[#b5cea8]";

  const KEYWORD_RE = /^(circuit|input|output|clock|state|impl|node|connect|on)\b/;

  return code.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    const indent = line.slice(0, line.length - trimmed.length);

    if (trimmed.startsWith("//")) {
      return <div key={i}>{indent}<span className={COMMENT}>{trimmed}</span></div>;
    }

    const tokens: React.ReactNode[] = [];
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
      // After ": " — component type
      if (eat(/^:\s*/, "text-muted-foreground")) {
        eat(/^[A-Z]\w*/, COMPONENT);
        // Params in parens
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
  children: React.ReactNode;
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
  children: React.ReactNode;
  className?: string;
  showMcp?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border border-border ${
        className ?? ""
      }`}
    >
      {/* Title bar */}
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
      {/* Content area — follows page theme */}
      <div className="flex-1 min-h-0 bg-card text-foreground">{children}</div>
    </div>
  );
}

// ============================================================================
// Circuit viewer
// ============================================================================


// ============================================================================
// Terminal line component
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
}: {
  onCodeStage: () => void;
  onComplete: () => void;
  extraLines: TermLine[];
}) {
  const allLines = useRef(DEMO_SCRIPT);
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentDone, setCurrentDone] = useState(false);
  const onCodeStageRef = useRef(onCodeStage);
  onCodeStageRef.current = onCodeStage;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const prevExtraLen = useRef(0);

  // When extraLines grow, append them
  useEffect(() => {
    if (extraLines.length > prevExtraLen.current) {
      const newLines = extraLines.slice(prevExtraLen.current);
      allLines.current = [...allLines.current, ...newLines];
      prevExtraLen.current = extraLines.length;
      // Kick off playing the new lines
      const firstNew = allLines.current.length - newLines.length;
      const delay = newLines[0].delay;
      setTimeout(() => {
        setVisibleCount(firstNew + 1);
        setCurrentDone(false);
      }, delay || 100);
    }
  }, [extraLines]);

  useEffect(() => {
    const t = setTimeout(() => setVisibleCount(1), DEMO_SCRIPT[0].delay);
    return () => clearTimeout(t);
  }, []);

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

  // Trigger DSL typing when a write_circuit tool line becomes visible
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
// Route + Page
// ============================================================================

export const Route = createFileRoute("/")({
  component: Splash5Page,
});

// ============================================================================
// HeroBrowserWindow — owns typewriter state so it doesn't rerender the page
// ============================================================================

interface HeroBrowserWindowHandle {
  startTyping: () => void;
  pickPrompt: (option: PromptOption) => void;
}

const HeroBrowserWindow = forwardRef<HeroBrowserWindowHandle, {}>(
  function HeroBrowserWindow(_, ref) {
    const [codeTyping, setCodeTyping] = useState(false);
    const [activeCode, setActiveCode] = useState<string | null>(null);
    const [targetCode, setTargetCode] = useState(DEMO_DSL);

    const codeTw = useTypewriter(targetCode, 12, 0, codeTyping);

    useEffect(() => {
      if (codeTyping && codeTw.done) {
        setActiveCode(targetCode);
        setCodeTyping(false);
      }
    }, [codeTyping, codeTw.done, targetCode]);

    useImperativeHandle(ref, () => ({
      startTyping() { setCodeTyping(true); },
      pickPrompt(option: PromptOption) {
        setTargetCode(option.dsl);
        setActiveCode(null);
      },
    }), []);

    return (
      <BrowserWindow className="flex-1" showMcp={codeTyping || !!activeCode}>
        <div className="flex h-full">
          <div className="w-[250px] shrink-0 border-r border-border overflow-y-auto">
            <pre className="text-[12px] font-mono text-foreground/70 leading-relaxed whitespace-pre-wrap py-3 px-4 mx-auto">
              {codeTyping ? (
                <>
                  {highlightCode(codeTw.displayed)}
                  <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
                </>
              ) : activeCode ? (
                highlightCode(targetCode)
              ) : (
                <span className="text-muted-foreground/40 italic text-[11px]">
                  Waiting for circuit...
                </span>
              )}
            </pre>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 relative">
              {activeCode ? (
                <CircuitEmbed code={activeCode} height="100%" />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm font-mono">
                  {codeTyping ? "Compiling..." : ""}
                </div>
              )}
            </div>
            {activeCode && (
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

function Splash5Page() {
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

  const handleComplete = useCallback(() => {
    setDemoComplete(true);
  }, []);

  return (
    <div className="bg-background text-foreground">
      {/* Mobile: compact header + gallery */}
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
        <DemoGallery />
      </div>

      {/* Desktop layout — full screen first section */}
      <div className="hidden md:flex h-[calc(100vh-140px)] flex-col overflow-hidden relative">
        {/* Header — just the name, minimal */}
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
            <Link
              to="/learn"
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs"
            >
              Learn
            </Link>
            <Link
              to="/blog"
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs"
            >
              Blog
            </Link>
            <Link
              to="/challenges"
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs"
            >
              Challenges
            </Link>
            <Link
              to="/editor"
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs"
            >
              Editor
            </Link>
            <Link
              to="/docs/$" params={{ _splat: "" }}
              className="text-muted-foreground/60 hover:text-foreground/80 transition-colors text-xs"
            >
              Docs
            </Link>
          </div>
        </div>

        {/* Two windows */}
        <div className="flex flex-1 gap-4 px-5 pb-5 min-h-0">
          {/* Left window: Terminal */}
          <TerminalWindow className="w-[38%] flex-shrink-0">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <ScriptedTerminal
                  onCodeStage={handleCodeStage}
                  onComplete={handleComplete}
                  extraLines={extraLines}
                />
              </div>

              {/* CTA + prompt suggestions after demo */}
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

          {/* Right window: Browser */}
          <HeroBrowserWindow ref={heroRef} />
        </div>

      </div>
      {/* end full-screen section */}

      {/* Gallery */}
      {demoComplete ? <DemoGallery /> : null}
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
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function DemoGallery() {
  return (
    <div className="relative px-4 py-16 md:py-24 md:animate-in md:fade-in md:duration-700 overflow-hidden">

      <div className="relative max-w-7xl mx-auto">
        {/* Bridge headline */}
        <div className="mb-20 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Text in. Live circuit out. All in your browser.
          </h2>
        </div>

        {/* Row 1: Featured demo (asymmetric) */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-4 mb-4">
          <CircuitEmbed
            title="Half Adder"
            subtitle="4 nodes · 6 connections"
            description="XOR for sum, AND for carry — the foundation of digital arithmetic."
            code={DEMO_DSL}
            href="/editor"
            height={300}
            nodePositions={{
              a:     { x: 10,  y: 10 },
              b:     { x: 10,  y: 170 },
              dut:   { x: 220, y: 90 },
              sum:   { x: 430, y: 10 },
              carry: { x: 430, y: 170 },
            }}
          />
          <div className="flex flex-col gap-4">
            <CircuitEmbed
              title="2-bit Counter"
              subtitle="Sequential · clock-driven"
              description="Two flip-flops count 00 → 01 → 10 → 11 → repeat."
              code={COUNTER_DSL}
              href="/editor"
              height={140}
              nodePositions={{
                dut:  { x: 10,  y: 20 },
                bit0: { x: 210, y: 5 },
                bit1: { x: 210, y: 75 },
              }}
            />
            <SnakeCard />
          </div>
        </div>

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
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Explore inside any component
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
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
                code={DRILLDOWN_DSL}
                height={320}
                nodePositions={{
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
              code={SHIFT_REGISTER_DSL}
              height={340}
              theme="dark"
              initialInputs={{ din: 1 }}
              nodePositions={{
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
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Rewind any clock cycle
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
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

        {/* Row 2: complex demos */}
        <h3 className="text-lg font-semibold text-foreground mb-1 mt-36">Scale to real-world complexity</h3>
        <p className="text-[13px] text-muted-foreground/60 mb-4">Full CPUs, networked systems, hundreds of nodes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ComplexDemoCard
            title="RV32I CPU Debugger"
            subtitle="~300 lines of DSL"
            description="Write C, compile it, watch it execute instruction by instruction on a real 5-stage pipelined RISC-V CPU."
            href="/learn/cpu"
            accent="blue"
            snippet={`const RV32I_CPU = circuit('RV32I_CPU', {\n  // IF → ID → EX → MEM → WB\n  nodes: {\n    ifid_pc: Register,\n    idex_pc: Register,\n    exmem_alu: Register,\n    memwb_rd: Register,\n    // ...+280 lines\n  },\n})`}
          />
          <ComplexDemoCard
            title="Dual CPU Network"
            subtitle="~400 lines"
            description="Two independent RISC-V CPUs communicating via a memory-mapped NIC. Watch packets travel cycle by cycle."
            href="/learn/dual-cpu"
            accent="violet"
            snippet={`const RV32I_DualCPU = circuit('RV32I_DualCPU', {\n  nodes: {\n    cpu0: RV32I_CPU,\n    cpu1: RV32I_CPU,\n    nic0: NIC_FIFO,\n    nic1: NIC_FIFO,\n  },\n  // cross-connect NICs\n})`}
          />
        </div>

        {/* Row 3: Ethernet parser — full width */}
        <h3 className="text-lg font-semibold text-foreground mb-1 mt-20">Real protocols, simulated from gates</h3>
        <p className="text-[13px] text-muted-foreground/60 mb-4">IEEE 802.3 Ethernet frame parsing — MAC addresses, EtherType, CRC-32, all running live</p>
        <EthernetParserCard />

        {/* Row 4: Featured deep dives */}
        <div className="mt-40">
          <h3 className="text-lg font-semibold text-foreground mb-1">Interactive deep dives</h3>
          <p className="text-[13px] text-muted-foreground/60 mb-5">Not diagrams. Live circuits verified against real specifications.</p>
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
        </div>

        {/* Row 5: Embed CTA */}
        <div className="mt-40">
          <h3 className="text-lg font-semibold text-foreground mb-1">Embed in your own site</h3>
          <p className="text-[13px] text-muted-foreground/60 mb-5">One component. Your docs get live, interactive hardware simulations.</p>
          <PackageManagerTabs package="@turing-incomplete/embed" />
          <div className="rounded-lg border border-border bg-card overflow-hidden mt-4">
            <pre className="px-4 py-3 text-[12px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
              <span className="text-violet-400">{"import"}</span>{" { CircuitEmbed } "}
              <span className="text-violet-400">{"from"}</span>{" "}
              <span className="text-green-400">{"'@turing-incomplete/embed'"}</span>
              {"\n\n"}
              <span className="text-muted-foreground">{"// Compiles, simulates, and renders — in one component"}</span>
              {"\n"}
              {"<"}
              <span className="text-blue-400">{"CircuitEmbed"}</span>
              {"\n  "}
              <span className="text-cyan-400">{"dsl"}</span>
              {"={myCircuitDSL}"}
              {"\n  "}
              <span className="text-cyan-400">{"height"}</span>
              {"={300}"}
              {"\n/>"}
            </pre>
          </div>
        </div>

        {/* Row 5.5: Headless simulation */}
        <div className="mt-40">
          <h3 className="text-lg font-semibold text-foreground mb-1">Run headless — no browser needed</h3>
          <p className="text-[13px] text-muted-foreground/60 mb-5">The same engine runs in Node.js, CI pipelines, and MCP tools at 20,000+ ticks/sec.</p>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="flex-1 text-center text-[11px] text-muted-foreground font-mono">terminal</span>
            </div>
            <pre className="px-5 py-4 text-[12px] font-mono leading-relaxed overflow-x-auto">
<span className="text-muted-foreground">{"$ "}</span><span className="text-foreground">{"npx @turing-incomplete/core simulate rv32i-board.dsl --ticks 1000"}</span>{"\n"}
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
        </div>

        {/* Row 6: Build with AI */}
        <div className="mt-40">
          <ClaudeCTA />
        </div>

        {/* Row 7: Verilog Export */}
        <div className="mt-40">
          <h3 className="text-lg font-semibold text-foreground mb-1">Export to Verilog</h3>
          <p className="text-[13px] text-muted-foreground/60 mb-5">Design in DSL. Export synthesisable Verilog. Verified cycle-by-cycle against Icarus Verilog.</p>
          <div className="grid grid-cols-2 gap-4">
            {/* DSL side */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-mono">circuit.dsl</div>
              <pre className="px-4 py-3 text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
<span className="text-violet-400">{"circuit"}</span>{" HalfAdder {\n"}
{"  "}<span className="text-violet-400">{"input"}</span>{" a: Bit\n"}
{"  "}<span className="text-violet-400">{"input"}</span>{" b: Bit\n"}
{"  "}<span className="text-violet-400">{"output"}</span>{" sum: Bit\n"}
{"  "}<span className="text-violet-400">{"output"}</span>{" carry: Bit\n"}
{"  "}<span className="text-violet-400">{"impl"}</span>{" {\n"}
{"    "}<span className="text-cyan-400">{"node"}</span>{" xor1: Xor\n"}
{"    "}<span className="text-cyan-400">{"node"}</span>{" and1: And\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" a -> xor1.a\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" b -> xor1.b\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" xor1.out -> sum\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" a -> and1.a\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" b -> and1.b\n"}
{"    "}<span className="text-green-400">{"connect"}</span>{" and1.out -> carry\n"}
{"  }\n}"}
              </pre>
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
          <p className="text-[11px] text-muted-foreground/60 mt-3">A 5-stage pipelined RISC-V CPU exports as 94KB of synthesisable RTL — cycle-accurate with the DSL simulator.</p>
        </div>

        <div className="mt-40 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
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
            <Link
              to="/challenges"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Try the challenges →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-32 pt-10 pb-16 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2.5">
          <Logo size={18} className="text-muted-foreground/60" />
          <span className="text-[12px] text-muted-foreground/60">Turing Incomplete</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/docs" className="text-[12px] text-muted-foreground/60 hover:text-foreground/80 transition-colors">Docs</a>
          <Link to="/blog" className="text-[12px] text-muted-foreground/60 hover:text-foreground/80 transition-colors">Blog</Link>
          <Link to="/learn" className="text-[12px] text-muted-foreground/60 hover:text-foreground/80 transition-colors">Learn</Link>
          <a
            href="https://github.com/charlesharris/turing-incomplete"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-muted-foreground/60 hover:text-foreground/80 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

const GRID = 8;
const PX = 24;
const GAP = 2;

function useSnakePixels(sequentialState: unknown): number[] {
  return useMemo(() => {
    const pixels = new Array(64).fill(0);
    const state = sequentialState as {
      currentState?: Map<string, unknown>;
    } | null;
    if (!state?.currentState) return pixels;
    for (const [nodeId, nodeState] of state.currentState) {
      if (nodeState instanceof Map && nodeId.toLowerCase().includes("ram")) {
        for (let i = 0; i < 64; i++)
          pixels[i] = (nodeState as Map<number, number>).get(i) ?? 0;
        break;
      }
    }
    return pixels;
  }, [sequentialState]);
}

function SnakeCard() {
  const { sim, isRunning, setIsRunning, sendDirection } = useSnakeSimulator();
  const pixels = useSnakePixels(sim.sequentialState);
  const total = GRID * PX + (GRID - 1) * GAP;

  // Set default direction to right once ready
  const directionSetRef = useRef(false);
  useEffect(() => {
    if (sim.ready && !directionSetRef.current) {
      directionSetRef.current = true;
      sendDirection(77); // right
    }
  }, [sim.ready, sendDirection]);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-card">
      {/* Preview — matches CircuitEmbed height */}
      <div
        className="flex items-center justify-center bg-black"
        style={{ height: 240 }}
      >
        {sim.ready ? (
          <svg
            viewBox={`0 0 ${total} ${total}`}
            width={total}
            height={total}
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
                ["↑", 72],
                ["←", 75],
                ["↓", 80],
                ["→", 77],
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

function frameToInitData(bytes: number[]): Record<number, number> {
  const obj: Record<number, number> = {};
  bytes.forEach((b, i) => { if (b !== 0) obj[i] = b; });
  return obj;
}

const ETH_FRAMES = [
  { label: "IPv4 unicast",    dst: [0x00,0x1A,0x2B,0x3C,0x4D,0x5E], src: [0xDE,0xAD,0xBE,0xEF,0xCA,0xFE], ethertype: 0x0800 },
  { label: "ARP broadcast",   dst: [0xFF,0xFF,0xFF,0xFF,0xFF,0xFF],   src: [0xAA,0xBB,0xCC,0xDD,0xEE,0xFF], ethertype: 0x0806 },
  { label: "IPv6 multicast",  dst: [0x33,0x33,0x00,0x00,0x00,0x01],  src: [0xFE,0xDC,0xBA,0x98,0x76,0x54], ethertype: 0x86DD },
] as const;

const ETH_PARSER_DSL = `
const Eth_802_3_Parser = circuit('Eth_802_3_Parser', {
  nodes: { frame_in: Eth_FrameInput, enable: Constant, parser: Eth_FrameParser, crc: Eth_CRC32, proto: Eth_ProtocolDecoder, addr: Eth_AddrClassifier },
  nodeArgs: { enable: { value: 1 } },
  connect: ({ out, frame_in, enable, parser, crc, proto, addr }) => [
    enable.out.to(frame_in.enable),
    frame_in.tdata.to(parser.tdata, crc.data),
    frame_in.tkeep.to(parser.tkeep, crc.tkeep),
    frame_in.tvalid.to(parser.tvalid, crc.data_valid),
    frame_in.tlast.to(parser.tlast, crc.tlast),
    parser.ethertype.to(proto.ethertype, out.ethertype),
    parser.dst_mac_hi.to(addr.dst_mac_hi, out.dst_mac_hi),
    parser.dst_mac_lo.to(addr.dst_mac_lo, out.dst_mac_lo),
    parser.src_mac_hi.to(out.src_mac_hi),
    parser.src_mac_lo.to(out.src_mac_lo),
    parser.frame_done.to(out.frame_done),
    crc.crc_ok.to(out.crc_ok),
    addr.is_broadcast.to(out.is_broadcast),
    proto.is_ipv4.to(out.is_ipv4),
  ],
})`;

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
  // Generate circuit code with frame data baked into nodeArgs
  const circuitCode = useMemo(() => {
    const initData = frameToInitData(frameBytes);
    return `
const Eth_802_3_Parser = circuit('Eth_802_3_Parser', {
  nodes: { frame_in: Eth_FrameInput, enable: Constant, parser: Eth_FrameParser, crc: Eth_CRC32, proto: Eth_ProtocolDecoder, addr: Eth_AddrClassifier },
  nodeArgs: { enable: { value: 1 }, frame_in: { init: ${JSON.stringify(initData)} } },
  connect: ({ frame_in, enable, parser, crc, proto, addr }) => [
    enable.out.to(frame_in.enable),
    frame_in.tdata.to(parser.tdata, crc.data),
    frame_in.tkeep.to(parser.tkeep, crc.tkeep),
    frame_in.tvalid.to(parser.tvalid, crc.data_valid),
    frame_in.tlast.to(parser.tlast, crc.tlast),
    parser.ethertype.to(proto.ethertype),
    parser.dst_mac_hi.to(addr.dst_mac_hi),
    parser.dst_mac_lo.to(addr.dst_mac_lo),
  ],
})`;
  }, [frameBytes]);
  const sim = useCircuitSimulator(circuitCode);

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
}: {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  accent: "blue" | "violet";
  snippet: string;
}) {
  const accentColor =
    accent === "blue" ? "text-blue-600 dark:text-blue-400/70" : "text-violet-600 dark:text-violet-400/70";
  const borderColor =
    accent === "blue" ? "border-blue-200 dark:border-blue-900/30" : "border-violet-200 dark:border-violet-900/30";
  const bgColor =
    accent === "blue" ? "from-blue-50 dark:from-blue-950/20" : "from-violet-50 dark:from-violet-950/20";

  const coloredSnippet = snippet.split("\n").map((line, i) => {
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
      <div
        className="flex-1 px-5 pt-5 pb-3 font-mono text-[12px] leading-6"
        style={{ height: 240 }}
      >
        {coloredSnippet}
      </div>
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
