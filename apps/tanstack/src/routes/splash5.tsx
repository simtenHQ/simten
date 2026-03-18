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
}: {
  dsl: string;
  height: number | string;
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

export const Route = createFileRoute("/splash5")({
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
        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={24} className="text-gray-300 shrink-0" />
            <span className="font-semibold text-[15px] tracking-tight text-gray-300">
              Turing Incomplete
            </span>
          </div>
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
              to="/"
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
                      to="/"
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
            href="/"
          />
          <LiveCircuitCard
            title="2-bit Counter"
            subtitle="4 nodes · 8 connections"
            description="Two flip-flops with toggle logic. Counts 00 → 01 → 10 → 11 → repeat."
            harness={COUNTER_HARNESS}
            href="/"
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

        <div className="mt-10 pt-8 border-t border-[#30363d] flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <p className="text-[13px] text-gray-600">
            Or build circuits yourself — no Claude needed.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-[13px] text-gray-500 hover:text-white transition-colors"
            >
              Open editor →
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
            ~100 nodes · use arrow keys
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

function LiveCircuitCard({
  title,
  subtitle,
  description,
  harness,
  href,
  height = 240,
}: {
  title: string;
  subtitle: string;
  description: string;
  harness: string;
  href: string;
  height?: number;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[#30363d] overflow-hidden bg-[#0d1117]">
      <div style={{ height }}>
        <DemoCircuit dsl={harness} height={height} />
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
