"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { CircuitCanvas } from "@turing-incomplete/ui/shared";
import { processStream } from "@/features/chat/streaming";
import type { AssistantAction } from "@/features/chat/types";

// ============================================================================
// Scripted demo data
// ============================================================================

const DEMO_PROMPT = "Build me a half adder";

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

const DEMO_RESPONSE =
  "Here's a half adder — XOR gives you the sum bit, AND gives you the carry. Toggle the switches to try all four input combinations: 0+0, 0+1, 1+0, 1+1.";

// ============================================================================
// Typewriter hook
// ============================================================================

function useTypewriter(
  text: string,
  speed: number,
  startDelay: number,
  active: boolean
) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

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
// Demo stages
// ============================================================================

type Stage =
  | "idle"
  | "prompt"
  | "dsl"
  | "circuit"
  | "response"
  | "interactive";

// ============================================================================
// Circuit viewer (only mounts when DSL is ready)
// ============================================================================

function DemoCircuit({
  dsl,
  height,
}: {
  dsl: string;
  height: number | string;
}) {
  const sim = useCircuitSimulator(dsl);

  if (!sim.ready) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
        Compiling...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <CircuitCanvas
          circuit={sim.circuit}
          portValues={sim.portValues}
          sequentialState={sim.sequentialState}
          onToggleNode={sim.toggleNode}
          drillDown={false}
          height={height}
        />
      </div>
      {sim.isSequential && (
        <div className="flex-shrink-0 flex items-center gap-2 pt-2 border-t border-gray-800">
          <button
            onClick={sim.tick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
          >
            Tick
          </button>
          <button
            onClick={sim.reset}
            className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
          >
            Reset
          </button>
          <span className="text-gray-600 text-xs ml-auto font-mono tabular-nums">
            #{sim.cycleCount}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DSL typewriter for live mode
// ============================================================================

function DslTypewriter({
  code,
  onDone,
}: {
  code: string;
  onDone: (code: string) => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i += 3; // faster for live — 3 chars at a time
      const slice = code.slice(0, i);
      setDisplayed(slice);
      if (i >= code.length) {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone(code);
        }
      }
    }, 10);
    return () => clearInterval(interval);
  }, [code, onDone]);

  return (
    <>
      {displayed}
      {displayed.length < code.length && (
        <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
      )}
    </>
  );
}

// ============================================================================
// Live chat (real LLM)
// ============================================================================

const FREE_MESSAGE_LIMIT = 5;

function LiveChat({
  onCircuitCode,
  initialPrompt,
}: {
  onCircuitCode: (dsl: string) => void;
  initialPrompt?: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const atLimit = userMessageCount >= FREE_MESSAGE_LIMIT;

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming || atLimit) return;
      setInput("");
      setError(null);

      const newMessages = [
        ...messages,
        { role: "user" as const, content: text },
      ];
      setMessages(newMessages);
      setStreaming(true);
      setStreamingText("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: text,
            dslCode: "",
            compactContext: "",
            conversationHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error || `HTTP ${response.status}`);
        }

        await processStream(response, {
          onMessageUpdate: (partial) => setStreamingText(partial),
          onToolCall: () => {},
          onComplete: (result) => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: result.message },
            ]);
            setStreamingText("");
            setStreaming(false);

            // Check for write_circuit action
            for (const action of result.actions) {
              const a = action as AssistantAction;
              if (a.type === "WRITE_CIRCUIT" && "code" in a) {
                onCircuitCode(a.code);
              }
            }
          },
          onError: (err) => {
            setError(err);
            setStreaming(false);
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStreaming(false);
      }
    },
    [streaming, messages, onCircuitCode]
  );

  // Send initial prompt automatically
  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      send(initialPrompt);
    }
  }, [initialPrompt, send]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${
              m.role === "user" ? "text-gray-200" : "text-gray-400"
            }`}
          >
            <span className="text-gray-600 text-xs mr-2">
              {m.role === "user" ? "you" : "claude"}
            </span>
            {m.content}
          </div>
        ))}
        {streaming && (
          <div className="text-sm text-gray-400">
            <span className="text-gray-600 text-xs mr-2">claude</span>
            {streamingText ? (
              <>
                {streamingText}
                <span className="inline-block w-[2px] h-[14px] bg-gray-500 ml-0.5 animate-pulse align-text-bottom" />
              </>
            ) : (
              <span className="text-gray-600 italic">thinking...</span>
            )}
          </div>
        )}
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or MCP nudge */}
      {atLimit && !streaming ? (
        <div className="border-t border-gray-800 px-4 py-4 space-y-3">
          <p className="text-sm text-gray-400">
            You&apos;ve used your {FREE_MESSAGE_LIMIT} free messages.
            Keep building with your own API key:
          </p>
          <div className="space-y-2">
            <div className="bg-gray-900 rounded-md border border-gray-800 px-3 py-2 font-mono text-xs text-gray-300">
              <span className="text-gray-500 select-none">$ </span>
              npx @turing-incomplete/mcp
            </div>
            <p className="text-xs text-gray-600">
              Adds the MCP server to Claude Code. Use your own model, unlimited.
            </p>
          </div>
          <Link
            href="/"
            className="block text-center px-4 py-2 bg-white text-gray-950 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Or continue in the full editor
          </Link>
        </div>
      ) : (
        <form
          className="border-t border-gray-800 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Describe a circuit... (${FREE_MESSAGE_LIMIT - userMessageCount} left)`}
              disabled={streaming}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="px-4 py-2 bg-white text-gray-950 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ============================================================================
// Starter prompts
// ============================================================================

const STARTERS = [
  "Build me a 4-bit counter",
  "Make an SR latch from NAND gates",
  "Create a 2-to-1 multiplexer",
];

// ============================================================================
// Page
// ============================================================================

export default function Splash5Page() {
  const [stage, setStage] = useState<Stage>("idle");
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [livePrompt, setLivePrompt] = useState<string | undefined>();

  // Circuit DSL that's compiled and rendered
  const [activeDsl, setActiveDsl] = useState<string | null>(null);
  // DSL text shown in the code panel (may differ — harness vs display)
  const [activeDslDisplay, setActiveDslDisplay] = useState<string | null>(null);
  // Pending DSL from live LLM — triggers typewriter before compiling
  const [pendingDsl, setPendingDsl] = useState<string | null>(null);

  // Kick off the scripted demo
  useEffect(() => {
    const timer = setTimeout(() => setStage("prompt"), 600);
    return () => clearTimeout(timer);
  }, []);

  // Typewriters for scripted demo
  const prompt = useTypewriter(DEMO_PROMPT, 40, 0, stage === "prompt");
  const dsl = useTypewriter(DEMO_DSL, 12, 0, stage === "dsl");
  const response = useTypewriter(DEMO_RESPONSE, 15, 0, stage === "response");

  // Scripted stage transitions
  useEffect(() => {
    if (stage === "prompt" && prompt.done) {
      const t = setTimeout(() => setStage("dsl"), 400);
      return () => clearTimeout(t);
    }
  }, [stage, prompt.done]);

  useEffect(() => {
    if (stage === "dsl" && dsl.done) {
      setActiveDsl(DEMO_HARNESS);
      setActiveDslDisplay(DEMO_DSL);
      const t = setTimeout(() => setStage("circuit"), 300);
      return () => clearTimeout(t);
    }
  }, [stage, dsl.done]);

  useEffect(() => {
    if (stage === "circuit") {
      const t = setTimeout(() => setStage("response"), 800);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "response" && response.done) {
      const t = setTimeout(() => setStage("interactive"), 500);
      return () => clearTimeout(t);
    }
  }, [stage, response.done]);

  // Live LLM returned circuit code — start typewriter
  const handleCircuitCode = useCallback((code: string) => {
    setPendingDsl(code);
    setActiveDslDisplay(null); // clear old display while typing
    setActiveDsl(null); // clear old circuit while typing
  }, []);

  // Typewriter finished — compile and show
  const handleDslTypewriterDone = useCallback((code: string) => {
    setActiveDsl(code);
    setActiveDslDisplay(code);
    setPendingDsl(null);
  }, []);

  // Switch to live chat with a starter prompt
  const switchToLive = useCallback((starterPrompt: string) => {
    setShowLiveChat(true);
    setLivePrompt(starterPrompt);
  }, []);

  // Determine what to show in the DSL panel
  const isScriptedDslTyping = stage === "dsl" && !dsl.done;
  const isLiveDslTyping = pendingDsl !== null;

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex-shrink-0 border-b border-gray-800/50 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-sm tracking-tight">
            Turing Incomplete
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/charlesharris/turing-incomplete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <Link
              href="/"
              className="px-3 py-1 bg-white text-gray-950 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              Full Editor
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat */}
        <div className="w-[340px] flex-shrink-0 border-r border-gray-800/50 flex flex-col">
          {showLiveChat ? (
            <LiveChat
              onCircuitCode={handleCircuitCode}
              initialPrompt={livePrompt}
            />
          ) : (
            <div className="flex flex-col h-full">
              {/* Scripted demo messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* User prompt */}
                {stage !== "idle" && (
                  <div className="text-sm">
                    <span className="text-gray-600 text-xs mr-2">you</span>
                    <span className="text-gray-200">
                      {prompt.displayed}
                      {stage === "prompt" && !prompt.done && (
                        <span className="inline-block w-[2px] h-[14px] bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
                      )}
                    </span>
                  </div>
                )}

                {/* Claude response */}
                {(stage === "response" || stage === "interactive") && (
                  <div className="text-sm">
                    <span className="text-gray-600 text-xs mr-2">claude</span>
                    <span className="text-gray-400">
                      {response.displayed}
                      {stage === "response" && !response.done && (
                        <span className="inline-block w-[2px] h-[14px] bg-gray-500 ml-0.5 animate-pulse align-text-bottom" />
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Try it yourself */}
              {stage === "interactive" && (
                <div className="border-t border-gray-800 px-4 py-3 space-y-2">
                  <div className="text-xs text-gray-500 mb-2">
                    Try it yourself
                  </div>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => switchToLive(s)}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-400 bg-gray-900/60 border border-gray-800 rounded-md hover:border-gray-600 hover:text-gray-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: DSL + Circuit */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* DSL code */}
          <div className="flex-shrink-0 border-b border-gray-800/50 max-h-[45%] overflow-auto">
            <div className="px-4 py-2">
              <div className="text-xs text-gray-600 mb-1 font-medium">DSL</div>
              <pre className="text-xs font-mono text-gray-400 leading-relaxed whitespace-pre-wrap">
                {isScriptedDslTyping ? (
                  <>
                    {dsl.displayed}
                    <span className="inline-block w-[2px] h-[12px] bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
                  </>
                ) : isLiveDslTyping ? (
                  <DslTypewriter
                    code={pendingDsl}
                    onDone={handleDslTypewriterDone}
                  />
                ) : activeDslDisplay ? (
                  activeDslDisplay
                ) : (
                  <span className="text-gray-700 italic">
                    Waiting for circuit...
                  </span>
                )}
              </pre>
            </div>
          </div>

          {/* Circuit canvas */}
          <div className="flex-1 min-h-0 relative">
            {activeDsl ? (
              <DemoCircuit dsl={activeDsl} height="100%" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-700 text-sm">
                {isScriptedDslTyping || isLiveDslTyping
                  ? "Compiling..."
                  : "Circuit will appear here"}
              </div>
            )}
          </div>

          {/* Open in editor link */}
          {activeDsl && (
            <div className="flex-shrink-0 border-t border-gray-800/50 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                Click switches to interact
              </span>
              <Link
                href="/"
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Open in full editor →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
