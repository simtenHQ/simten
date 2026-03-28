import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";
import { Logo } from "@/components/Logo";
import { useSnakeSimulator } from "@/features/blog/snake-in-hardware/useSnakeSimulator";

// ============================================================================
// Demo data
// ============================================================================

const DEMO_DSL = `circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}`;

const DEMO_HARNESS = `${DEMO_DSL}

circuit HalfAdderDemo {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node dut: HalfAdder
    node led_sum: Led
    node led_carry: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect dut.sum -> led_sum.in
    connect dut.carry -> led_carry.in
  }
}`;

// --- Toggle (DFlipFlop with NOT feedback) ---

const TOGGLE_DSL = `circuit Toggle {
  clock clk
  output q: Bit
  output q_bar: Bit
  impl {
    node dff: DFlipFlop
    node inv: Not
    connect dff.q -> inv.in
    connect inv.out -> dff.d
    connect clk -> dff.clk
    connect dff.q -> q
    connect dff.q_bar -> q_bar
  }
}`;

const TOGGLE_HARNESS = `${TOGGLE_DSL}

circuit ToggleDemo {
  clock clk
  impl {
    node dut: Toggle
    node led_q: Led
    node led_qbar: Led
    connect clk -> dut.clk
    connect dut.q -> led_q.in
    connect dut.q_bar -> led_qbar.in
  }
}`;

// --- Full Adder ---

const FULL_ADDER_DSL = `circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node xor1: Xor
    node xor2: Xor
    node and1: And
    node and2: And
    node or1: Or
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> xor2.a
    connect cin -> xor2.b
    connect xor2.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect xor1.out -> and2.a
    connect cin -> and2.b
    connect and1.out -> or1.a
    connect and2.out -> or1.b
    connect or1.out -> cout
  }
}`;

const FULL_ADDER_HARNESS = `${FULL_ADDER_DSL}

circuit FullAdderDemo {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_cin: Switch
    node dut: FullAdder
    node led_sum: Led
    node led_cout: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect sw_cin.out -> dut.cin
    connect dut.sum -> led_sum.in
    connect dut.cout -> led_cout.in
  }
}`;

// --- 2-bit Counter ---

const COUNTER_DSL = `circuit Counter2Bit {
  clock clk
  output bit0: Bit
  output bit1: Bit
  impl {
    node dff0: DFlipFlop
    node dff1: DFlipFlop
    node inv: Not
    node xor1: Xor
    connect dff0.q -> inv.in
    connect inv.out -> dff0.d
    connect clk -> dff0.clk
    connect dff0.q -> bit0
    connect dff1.q -> xor1.a
    connect dff0.q -> xor1.b
    connect xor1.out -> dff1.d
    connect clk -> dff1.clk
    connect dff1.q -> bit1
  }
}`;

const COUNTER_HARNESS = `${COUNTER_DSL}

circuit CounterDemo {
  clock clk
  impl {
    node dut: Counter2Bit
    node led0: Led
    node led1: Led
    connect clk -> dut.clk
    connect dut.bit0 -> led0.in
    connect dut.bit1 -> led1.in
  }
}`;

// --- 2-to-1 Mux ---

const MUX_DSL = `circuit Mux2to1 {
  input a: Bit
  input b: Bit
  input sel: Bit
  output out: Bit
  impl {
    node not1: Not
    node and1: And
    node and2: And
    node or1: Or
    connect sel -> not1.in
    connect a -> and1.a
    connect not1.out -> and1.b
    connect b -> and2.a
    connect sel -> and2.b
    connect and1.out -> or1.a
    connect and2.out -> or1.b
    connect or1.out -> out
  }
}`;

const MUX_HARNESS = `${MUX_DSL}

circuit MuxDemo {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_sel: Switch
    node dut: Mux2to1
    node led_out: Led
    connect sw_a.out -> dut.a
    connect sw_b.out -> dut.b
    connect sw_sel.out -> dut.sel
    connect dut.out -> led_out.in
  }
}`;

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
  harness: string;
  dslDisplay: string;
  script: TermLine[];
};

const PROMPT_OPTIONS: PromptOption[] = [
  {
    label: "Build a full adder",
    dsl: FULL_ADDER_DSL,
    harness: FULL_ADDER_HARNESS,
    dslDisplay: FULL_ADDER_DSL,
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
    harness: COUNTER_HARNESS,
    dslDisplay: COUNTER_DSL,
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
    harness: TOGGLE_HARNESS,
    dslDisplay: TOGGLE_DSL,
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
    harness: MUX_HARNESS,
    dslDisplay: MUX_DSL,
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
      className={`flex flex-col rounded-lg overflow-hidden border border-[#30363d] shadow-2xl ${
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
      <div className="flex-1 min-h-0 bg-[#0d1117]">{children}</div>
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
      className={`flex flex-col rounded-lg overflow-hidden border border-[#30363d] shadow-2xl ${
        className ?? ""
      }`}
    >
      <div className="flex-shrink-0 bg-[#161b22] px-4 h-11 flex items-center gap-3 border-b border-[#30363d]">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        {/* URL bar */}
        <div className="flex-1 flex items-center bg-[#0d1117] rounded-full border border-[#30363d] px-3 h-6 gap-2 min-w-0">
          <svg
            className="w-3 h-3 text-gray-600 shrink-0"
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
          <span className="text-[12px] text-gray-400 font-mono truncate">
            turingincomplete.com
          </span>
        </div>
        {/* MCP badge */}
        {showMcp && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/80 border border-gray-700/50 px-2.5 py-1 text-[11px] text-gray-400 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            MCP connected
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 bg-[#0d1117]">{children}</div>
    </div>
  );
}

// ============================================================================
// Circuit viewer
// ============================================================================

function DemoCircuit({
  dsl,
  height,
  nodePositions,
}: {
  dsl: string;
  height: number | string;
  nodePositions?: Record<string, { x: number; y: number }>;
}) {
  const sim = useCircuitSimulator(dsl);
  const [tickCount, setTickCount] = useState(0);

  const handleTick = useCallback(() => {
    sim.tick();
    setTickCount((c) => c + 1);
  }, [sim.tick]);

  if (!sim.ready) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
        Compiling...
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <CircuitCanvas
        circuit={sim.circuit}
        portValues={sim.portValues}
        sequentialState={sim.sequentialState}
        onToggleNode={sim.toggleNode}
        drillDown={true}
        height={height}
        nodePositions={nodePositions}
      />
      {sim.isSequential && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {tickCount > 0 && (
            <span className="text-[11px] text-gray-600 font-mono tabular-nums">
              cycle {tickCount}
            </span>
          )}
          <button
            onClick={handleTick}
            className={`px-3 py-1.5 text-[11px] font-medium rounded border transition-all ${
              tickCount === 0
                ? "bg-blue-600 border-blue-500 text-white animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                : "bg-[#161b22] border-[#30363d] text-gray-300 hover:border-gray-500"
            }`}
          >
            Tick
          </button>
        </div>
      )}
    </div>
  );
}

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
  onDslStage,
  onComplete,
  extraLines,
}: {
  onDslStage: () => void;
  onComplete: () => void;
  extraLines: TermLine[];
}) {
  const allLines = useRef(DEMO_SCRIPT);
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentDone, setCurrentDone] = useState(false);
  const onDslStageRef = useRef(onDslStage);
  onDslStageRef.current = onDslStage;
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
      onDslStageRef.current();
    }
  }, [visibleCount]);

  const handleLineDone = useCallback(() => {
    setCurrentDone(true);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

function Splash5Page() {
  const [dslTyping, setDslTyping] = useState(false);
  const [activeDsl, setActiveDsl] = useState<string | null>(null);
  const [activeDslDisplay, setActiveDslDisplay] = useState<string | null>(null);
  const [demoComplete, setDemoComplete] = useState(false);
  const [extraLines, setExtraLines] = useState<TermLine[]>([]);
  const [pickedPrompt, setPickedPrompt] = useState(false);
  const [targetDsl, setTargetDsl] = useState(DEMO_DSL);
  const [targetHarness, setTargetHarness] = useState(DEMO_HARNESS);

  const dslTw = useTypewriter(targetDsl, 12, 0, dslTyping);

  useEffect(() => {
    if (dslTyping && dslTw.done) {
      setActiveDsl(targetHarness);
      setActiveDslDisplay(targetDsl);
      setDslTyping(false);
    }
  }, [dslTyping, dslTw.done, targetDsl, targetHarness]);

  const handlePickPrompt = useCallback((option: PromptOption) => {
    setPickedPrompt(true);
    setDemoComplete(false);
    // Set up new DSL targets — will be used when DSL typing triggers
    setTargetDsl(option.dsl);
    setTargetHarness(option.harness);
    // Clear old circuit while new one builds
    setActiveDsl(null);
    setActiveDslDisplay(null);
    // Add a blank line separator then the new script
    const separator: TermLine = { type: "blank", content: "", delay: 300 };
    setExtraLines([separator, ...option.script]);
  }, []);

  const handleDslStage = useCallback(() => setDslTyping(true), []);
  const handleComplete = useCallback(() => {
    setDemoComplete(true);
  }, []);

  return (
    <div className="bg-[#010409] text-white">
      {/* Mobile: compact header + gallery */}
      <div className="md:hidden">
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22} className="text-gray-300 shrink-0" />
            <span className="font-semibold text-[14px] tracking-tight text-gray-300">
              Turing Incomplete
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/learn" className="text-gray-600 hover:text-gray-300 transition-colors text-xs">Learn</Link>
            <Link to="/blog" className="text-gray-600 hover:text-gray-300 transition-colors text-xs">Blog</Link>
            <Link to="/challenges" className="text-gray-600 hover:text-gray-300 transition-colors text-xs">Challenges</Link>
            <Link to="/editor" className="text-gray-600 hover:text-gray-300 transition-colors text-xs">Editor</Link>
          </div>
        </div>
        <div className="px-5 pb-6 flex flex-col items-center text-center gap-4">
          <p className="text-sm text-gray-500 max-w-xs">
            A circuit simulator you talk to with Claude Code.
          </p>
          <CopyCommand command="claude mcp add turing-incomplete npx @turing-incomplete/mcp" />
        </div>
        <DemoGallery />
      </div>

      {/* Desktop layout — full screen first section */}
      <div className="hidden md:flex h-screen flex-col overflow-hidden relative">
        {/* Header — just the name, minimal */}
        <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={28} className="text-gray-300 shrink-0" />
            <div>
              <div className="font-semibold text-[15px] tracking-tight text-gray-300">
                Turing Incomplete
              </div>
              <div className="text-[11px] text-gray-600">
                A live circuit simulator you talk to
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/charlesharris/turing-incomplete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-300 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <Link
              to="/learn"
              className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
            >
              Learn
            </Link>
            <Link
              to="/blog"
              className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
            >
              Blog
            </Link>
            <Link
              to="/challenges"
              className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
            >
              Challenges
            </Link>
            <Link
              to="/editor"
              className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
            >
              Editor
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
                  onDslStage={handleDslStage}
                  onComplete={handleComplete}
                  extraLines={extraLines}
                />
              </div>

              {/* CTA + prompt suggestions after demo */}
              {demoComplete && (
                <div className="flex-shrink-0 border-t border-[#30363d] px-5 py-4 space-y-3 animate-in fade-in duration-500">
                  <p className="font-mono text-[13px] text-gray-300">
                    Build circuits by describing them — compiled and simulated
                    live in your browser.
                  </p>
                  <div className="bg-[#161b22] rounded-md border border-[#30363d] px-3 py-2.5 font-mono text-xs text-gray-300 select-all cursor-pointer hover:border-gray-600 transition-colors">
                    <span className="text-gray-500 select-none">$ </span>
                    claude mcp add turing-incomplete npx @turing-incomplete/mcp
                  </div>
                  {!pickedPrompt && (
                    <div className="pt-2 border-t border-[#30363d] mt-3 space-y-2">
                      <div className="flex items-center gap-2 font-mono text-[13px]">
                        <span className="text-gray-200">&gt;</span>
                        <span className="text-gray-600">
                          Or try another demo...
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
          <BrowserWindow className="flex-1" showMcp={dslTyping || !!activeDsl}>
            <div className="flex h-full">
              {/* DSL code strip — thin left panel */}
              <div className="w-[250px] shrink-0 border-r border-[#30363d] overflow-y-auto">
                <pre className="text-[12px] font-mono text-gray-500 leading-relaxed whitespace-pre-wrap py-3 px-4 mx-auto">
                  {dslTyping ? (
                    <>
                      {dslTw.displayed}
                      <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
                    </>
                  ) : activeDslDisplay ? (
                    activeDslDisplay
                  ) : (
                    <span className="text-gray-700 italic text-[11px]">
                      Waiting for circuit...
                    </span>
                  )}
                </pre>
              </div>

              {/* Circuit canvas + footer */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 min-h-0 relative">
                  {activeDsl ? (
                    <DemoCircuit dsl={activeDsl} height="100%" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-700 text-sm font-mono">
                      {dslTyping ? "Compiling..." : ""}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {activeDsl && (
                  <div className="flex-shrink-0 border-t border-[#30363d] px-4 py-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-600">
                      Click switches to interact
                    </span>
                    <Link
                      to="/editor"
                      className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      Open in full editor
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </BrowserWindow>
        </div>

        {/* Scroll hint */}
        {demoComplete && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-in fade-in duration-1000">
            <span className="text-[11px] text-gray-600 tracking-widest uppercase">
              scroll
            </span>
            <svg
              className="w-4 h-4 text-gray-600 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        )}
      </div>
      {/* end full-screen section */}

      {/* Gallery */}
      {demoComplete && <DemoGallery />}
    </div>
  );
}

// ============================================================================
// Gallery
// ============================================================================

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div className="inline-flex items-center gap-3 bg-[#161b22] rounded-lg border border-[#30363d] px-4 py-3 group max-w-full overflow-x-auto">
      <span className="text-gray-600 font-mono text-sm select-none">$</span>
      <span className="font-mono text-sm text-gray-200">{command}</span>
      <button
        onClick={copy}
        className="ml-2 text-gray-600 hover:text-gray-300 transition-colors shrink-0"
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

const CYCLING_PHRASES = [
  "a half adder",
  "a RISC-V CPU",
  "Snake in hardware",
  "a packet sniffer",
  "a 4-bit ALU",
];

function useCyclingTypewriter(
  phrases: string[],
  typeSpeed = 60,
  deleteSpeed = 30,
  pauseMs = 1800,
) {
  const [displayed, setDisplayed] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">(
    "typing",
  );

  useEffect(() => {
    const target = phrases[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (displayed.length < target.length) {
        timeout = setTimeout(
          () => setDisplayed(target.slice(0, displayed.length + 1)),
          typeSpeed,
        );
      } else {
        timeout = setTimeout(() => setPhase("pausing"), pauseMs);
      }
    } else if (phase === "pausing") {
      setPhase("deleting");
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(
          () => setDisplayed(displayed.slice(0, -1)),
          deleteSpeed,
        );
      } else {
        setPhraseIndex((i) => (i + 1) % phrases.length);
        setPhase("typing");
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, phase, phraseIndex, phrases, typeSpeed, deleteSpeed, pauseMs]);

  return displayed;
}

function DemoGallery() {
  const cyclingText = useCyclingTypewriter(CYCLING_PHRASES);

  return (
    <div className="px-4 py-10 md:py-20 md:animate-in md:fade-in md:duration-700">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-100 mb-6">
            <div>Ask Claude to build...</div>
            <div className="text-green-400 font-mono mt-1">
              {cyclingText}
              <span className="inline-block w-[2px] h-[1em] bg-green-400 ml-0.5 align-middle animate-pulse" />
            </div>
          </h2>
          <CopyCommand command="claude mcp add turing-incomplete npx @turing-incomplete/mcp" />
        </div>

        {/* Row 1: live circuits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <LiveCircuitCard
            title="Half Adder"
            subtitle="4 nodes · 6 connections"
            description="XOR for sum, AND for carry. The building block of every adder."
            harness={DEMO_HARNESS}
            href="/editor"
            nodePositions={{
              sw_a:     { x: 10,  y: 10 },
              sw_b:     { x: 10,  y: 130 },
              dut:      { x: 185, y: 70 },
              led_sum:  { x: 360, y: 10 },
              led_carry:{ x: 360, y: 130 },
            }}
          />
          <LiveCircuitCard
            title="2-bit Counter"
            subtitle="4 nodes · 8 connections"
            description="Two flip-flops with toggle logic. Counts 00 → 01 → 10 → 11 → repeat."
            harness={COUNTER_HARNESS}
            href="/editor"
            nodePositions={{
              clk:  { x: 10,  y: 70 },
              dut:  { x: 190, y: 50 },
              led0: { x: 375, y: 10 },
              led1: { x: 375, y: 135 },
            }}
          />
          <SnakeCard />
        </div>

        {/* Row 2: complex demos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ComplexDemoCard
            title="RV32I CPU Debugger"
            subtitle="~300 lines of DSL"
            description="Write C, compile it, watch it execute instruction by instruction on a real 5-stage pipelined RISC-V CPU."
            href="/learn/cpu"
            accent="blue"
            snippet={`circuit RV32I_CPU {\n  // IF → ID → EX → MEM → WB\n  node ifid_pc:  Register(width=32)\n  node idex_pc:  Register(width=32)\n  node exmem_alu: Register(width=32)\n  node memwb_rd:  Register(width=32)\n  // ...+280 lines\n}`}
          />
          <ComplexDemoCard
            title="Dual CPU Network"
            subtitle="~400 lines of DSL"
            description="Two independent RISC-V CPUs communicating via a memory-mapped NIC. Watch packets travel cycle by cycle."
            href="/learn/dual-cpu"
            accent="violet"
            snippet={`circuit RV32I_DualCPU {\n  node cpu0: RV32I_CPU\n  node cpu1: RV32I_CPU\n  node nic0: NIC_FIFO\n  node nic1: NIC_FIFO\n  // cross-connect NICs:\n  // cpu0 TX → cpu1 RX\n  // cpu1 TX → cpu0 RX\n}`}
          />
        </div>

        {/* Row 3: Ethernet parser — full width */}
        <EthernetParserCard />

        {/* Row 4: Featured deep dives */}
        <div className="mt-10 pt-8 border-t border-[#30363d]">
          <h3 className="text-lg font-semibold text-gray-200 mb-1">Interactive deep dives</h3>
          <p className="text-[13px] text-gray-600 mb-5">Not diagrams. Live circuits verified against real specifications.</p>
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
                className="group rounded-lg border border-[#21262d] hover:border-[#30363d] bg-[#0d1117] hover:bg-[#161b22] transition-all px-4 py-3.5"
              >
                <h4 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                  {post.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {post.hook}
                </p>
                <span className="inline-block mt-2.5 text-[11px] text-blue-400 group-hover:text-blue-300 transition-colors">
                  Read &rarr;
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 text-right">
            <Link to="/blog" className="text-[12px] text-gray-600 hover:text-gray-300 transition-colors">
              All articles &rarr;
            </Link>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[#30363d] flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <p className="text-[13px] text-gray-600">
            Or build circuits yourself — no Claude needed.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/editor"
              className="text-[13px] text-gray-500 hover:text-white transition-colors"
            >
              Open editor →
            </Link>
            <Link
              to="/learn"
              className="text-[13px] text-gray-500 hover:text-white transition-colors"
            >
              Learn →
            </Link>
            <Link
              to="/challenges"
              className="text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              Try the challenges →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto mt-16 pt-6 pb-10 border-t border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2.5">
          <Logo size={18} className="text-gray-600" />
          <span className="text-[12px] text-gray-600">Turing Incomplete</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/docs" className="text-[12px] text-gray-600 hover:text-gray-300 transition-colors">Docs</a>
          <Link to="/blog" className="text-[12px] text-gray-600 hover:text-gray-300 transition-colors">Blog</Link>
          <Link to="/learn" className="text-[12px] text-gray-600 hover:text-gray-300 transition-colors">Learn</Link>
          <a
            href="https://github.com/charlesharris/turing-incomplete"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-gray-600 hover:text-gray-300 transition-colors"
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
    <div className="flex flex-col rounded-lg border border-[#30363d] overflow-hidden bg-[#0d1117]">
      {/* Preview — matches LiveCircuitCard height */}
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
          <div className="text-gray-700 text-[11px] font-mono">Compiling…</div>
        )}
      </div>

      {/* Info strip — matches LiveCircuitCard */}
      <div className="border-t border-[#30363d] px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-gray-200">Snake</div>
          <div className="text-[11px] text-gray-600 font-mono mt-0.5">
            ~100 nodes · zero software
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={!sim.ready}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40 ${
                isRunning
                  ? "bg-amber-800 hover:bg-amber-700 text-amber-200"
                  : "bg-green-900 hover:bg-green-800 text-green-300"
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
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-[9px] transition-colors"
              >
                {arrow}
              </button>
            ))}
          </div>
        </div>
        <Link
          to="/blog/snake-in-hardware"
          className="shrink-0 px-3 py-1.5 rounded border border-[#30363d] text-[11px] text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
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

function frameToMemory(bytes: number[]): Map<string, Map<number, number>> {
  const m = new Map<number, number>();
  bytes.forEach((b, i) => m.set(i, b));
  return new Map([["eth_frameinput", m]]);
}

const ETH_FRAMES = [
  { label: "IPv4 unicast",    dst: [0x00,0x1A,0x2B,0x3C,0x4D,0x5E], src: [0xDE,0xAD,0xBE,0xEF,0xCA,0xFE], ethertype: 0x0800 },
  { label: "ARP broadcast",   dst: [0xFF,0xFF,0xFF,0xFF,0xFF,0xFF],   src: [0xAA,0xBB,0xCC,0xDD,0xEE,0xFF], ethertype: 0x0806 },
  { label: "IPv6 multicast",  dst: [0x33,0x33,0x00,0x00,0x00,0x01],  src: [0xFE,0xDC,0xBA,0x98,0x76,0x54], ethertype: 0x86DD },
] as const;

const ETH_PARSER_DSL = `circuit Eth_802_3_Parser {
  output dst_mac_hi: Bus[16]
  output dst_mac_lo: Bus[32]
  output src_mac_hi: Bus[16]
  output src_mac_lo: Bus[32]
  output ethertype: Bus[16]
  output frame_done: Bit
  output crc_ok: Bit
  output is_broadcast: Bit
  output is_ipv4: Bit
  impl {
    node frame_in: Eth_FrameInput
    node enable: Constant(value=1, width=1)
    connect enable.out -> frame_in.enable
    node parser: Eth_FrameParser
    connect frame_in.tdata -> parser.tdata
    connect frame_in.tkeep -> parser.tkeep
    connect frame_in.tvalid -> parser.tvalid
    connect frame_in.tlast -> parser.tlast
    node crc: Eth_CRC32
    connect frame_in.tdata -> crc.data
    connect frame_in.tvalid -> crc.data_valid
    connect frame_in.tkeep -> crc.tkeep
    connect frame_in.tlast -> crc.tlast
    node proto: Eth_ProtocolDecoder
    connect parser.ethertype -> proto.ethertype
    node addr: Eth_AddrClassifier
    connect parser.dst_mac_hi -> addr.dst_mac_hi
    connect parser.dst_mac_lo -> addr.dst_mac_lo
    connect parser.dst_mac_hi -> dst_mac_hi
    connect parser.dst_mac_lo -> dst_mac_lo
    connect parser.src_mac_hi -> src_mac_hi
    connect parser.src_mac_lo -> src_mac_lo
    connect parser.ethertype -> ethertype
    connect parser.frame_done -> frame_done
    connect crc.crc_ok -> crc_ok
    connect addr.is_broadcast -> is_broadcast
    connect proto.is_ipv4 -> is_ipv4
  }
}`;

function readEthPort(
  pv: ReadonlyMap<string, boolean | number> | null,
  nodeLabel: string,
  portName: string,
): number | boolean | null {
  if (!pv) return null;
  const suffix = `.${portName}`;
  for (const [key, val] of pv) {
    if (key.endsWith(suffix) && key.includes(`_${nodeLabel}_`)) return val;
  }
  return null;
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
  const memory = useMemo(() => frameToMemory(frameBytes), [frameBytes]);
  const sim = useCircuitSimulator(ETH_PARSER_DSL, { initialMemory: memory });

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
    blue:   { border: "border-blue-500",   text: "text-blue-400"   },
    violet: { border: "border-violet-500", text: "text-violet-400" },
    amber:  { border: "border-amber-500",  text: "text-amber-400"  },
    gray:   { border: "border-gray-600",   text: "text-gray-500"   },
    green:  { border: "border-green-600",  text: "text-green-400"  },
  };
  const c = palette[color] ?? palette.gray;
  return (
    <div className={`flex items-center gap-2 py-0.5 border-l-2 pl-2 transition-all duration-150 ${active ? c.border : "border-transparent"}`}>
      <span className={`w-14 text-[9px] uppercase tracking-wide shrink-0 transition-colors ${active ? c.text : "text-gray-700"}`}>
        {label}
      </span>
      <span className={`font-mono text-[10px] transition-colors ${active ? "text-gray-200" : valid ? "text-gray-600" : "text-gray-800"}`}>
        {bytes}
      </span>
    </div>
  );
}

function EthParsedField({ label, value, tag, tagColor, valid }: {
  label: string; value: string; tag?: string; tagColor?: string; valid: boolean;
}) {
  const tagCls: Record<string, string> = {
    blue:    "text-blue-300 bg-blue-950/70",
    orange:  "text-orange-300 bg-orange-950/70",
    emerald: "text-emerald-300 bg-emerald-950/70",
    violet:  "text-violet-300 bg-violet-950/70",
  };
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-300 ${valid ? "opacity-100" : "opacity-20"}`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${valid ? "bg-emerald-400" : "bg-gray-700"}`} />
      <span className="text-[11px] text-gray-500 font-mono w-20 shrink-0">{label}</span>
      <span className={`font-mono text-[11px] ${valid ? "text-gray-200" : "text-gray-700"}`}>{value}</span>
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
    <div className="rounded-lg border border-[#30363d] overflow-hidden bg-[#0d1117] mt-4">
      <div className="flex flex-col sm:flex-row" style={{ minHeight: 200 }}>
        {/* Left: raw frame bytes */}
        <div className="sm:w-[42%] shrink-0 border-b sm:border-b-0 sm:border-r border-[#30363d] px-5 py-4 font-mono">
          <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>incoming frame</span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
              frameIndex === 0 ? "bg-blue-950/60 text-blue-400" :
              frameIndex === 1 ? "bg-orange-950/60 text-orange-400" :
              "bg-violet-950/60 text-violet-400"
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
            <div className="h-0.5 bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-700 font-mono">
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
      <div className="border-t border-[#30363d] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-gray-200">Ethernet Parser</span>
          <span className="text-[11px] text-gray-600 font-mono">MAC RX pipeline · Layer 2 · IEEE 802.3</span>
        </div>
        <div className="flex items-center gap-2">
          {ETH_FRAMES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === frameIndex ? "bg-blue-400" : "bg-gray-700"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveCircuitCard({
  title,
  subtitle,
  description,
  harness,
  href,
  height = 240,
  nodePositions,
}: {
  title: string;
  subtitle: string;
  description: string;
  harness: string;
  href: string;
  height?: number;
  nodePositions?: Record<string, { x: number; y: number }>;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[#30363d] overflow-hidden bg-[#0d1117]">
      <div style={{ height }}>
        <DemoCircuit dsl={harness} height={height} nodePositions={nodePositions} />
      </div>
      <div className="border-t border-[#30363d] px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-gray-200">{title}</div>
          <div className="text-[11px] text-gray-600 font-mono mt-0.5">
            {subtitle}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>
        <Link
          to={href}
          className="shrink-0 px-3 py-1.5 rounded border border-[#30363d] text-[11px] text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Open in editor
        </Link>
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
    accent === "blue" ? "text-blue-400/70" : "text-violet-400/70";
  const borderColor =
    accent === "blue" ? "border-blue-900/30" : "border-violet-900/30";
  const bgColor = accent === "blue" ? "from-blue-950/20" : "from-violet-950/20";

  const coloredSnippet = snippet.split("\n").map((line, i) => {
    const isComment = line.trim().startsWith("//");
    const isCircuit = line.startsWith("circuit");
    const isNode = line.trim().startsWith("node");
    return (
      <div
        key={i}
        className={
          isComment
            ? "text-gray-700"
            : isCircuit
            ? accentColor
            : isNode
            ? "text-gray-400"
            : "text-gray-600"
        }
      >
        {line || "\u00A0"}
      </div>
    );
  });

  return (
    <div
      className={`flex flex-col rounded-lg border ${borderColor} overflow-hidden bg-gradient-to-br ${bgColor} to-[#0d1117]`}
    >
      <div
        className="flex-1 px-5 pt-5 pb-3 font-mono text-[12px] leading-6"
        style={{ height: 240 }}
      >
        {coloredSnippet}
      </div>
      <div className="border-t border-[#30363d] px-4 py-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-gray-200">{title}</div>
          <div className="text-[11px] text-gray-600 font-mono mt-0.5">
            {subtitle}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>
        <Link
          to={href}
          className="shrink-0 px-3 py-1.5 rounded border border-[#30363d] text-[11px] text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Open demo →
        </Link>
      </div>
    </div>
  );
}
