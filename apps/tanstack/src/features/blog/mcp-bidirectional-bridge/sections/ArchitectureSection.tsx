"use client";

function Diagram() {
  return (
    <div className="my-8 rounded-xl border border-gray-800 bg-[#0d1117] p-6 md:p-8 overflow-x-auto">
      <pre className="text-sm md:text-base font-mono text-gray-300 leading-relaxed whitespace-pre">
        {`┌─────────────────────┐
│    Claude Code      │
│   (LLM + Client)    │
└─────────┬───────────┘
          │ stdio / streamable HTTP
          │
┌─────────▼───────────┐
│     MCP Server      │◄─── Tools: show_circuit, solve_next,
│  (Tool Provider)    │     check_progress, push_chat_response,
│                     │     get_circuit_state, simulate_circuit
│  ┌───────────────┐  │
│  │  WebSocket    │  │◄─── Bidirectional bridge
│  │  Server       │  │     (not part of MCP spec)
│  └───────┬───────┘  │
└──────────┼──────────┘
           │ ws://localhost:19847
           │
┌──────────▼──────────┐
│   Browser App       │
│                     │
│  ┌───────────────┐  │
│  │ Visual Editor │  │◄─── Receives DSL, traces, test results
│  │ + Chat Panel  │  │     Sends user prompts, circuit state
│  └───────────────┘  │
└─────────────────────┘`}
      </pre>
    </div>
  );
}

function CodeBlock({
  title,
  language,
  children,
}: {
  title: string;
  language: string;
  children: string;
}) {
  return (
    <div className="my-6 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">{title}</span>
        <span className="text-[10px] text-gray-600 font-mono uppercase">
          {language}
        </span>
      </div>
      <pre className="p-4 bg-[#0d1117] overflow-x-auto">
        <code className="text-sm font-mono text-gray-300 leading-relaxed">
          {children}
        </code>
      </pre>
    </div>
  );
}

export function ArchitectureSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          The Architecture: MCP + WebSocket Bridge
        </h2>

        <div className="space-y-5 text-gray-300 leading-relaxed">
          <p>
            The key insight is that the MCP server does{" "}
            <strong className="text-white">double duty</strong>. It&rsquo;s both
            a tool provider for Claude (standard MCP) and a WebSocket server for
            the browser (custom bridge). Same process, two protocols.
          </p>

          <Diagram />

          <p>
            The MCP server runs locally alongside Claude Code. When Claude calls
            a tool like{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              show_circuit
            </code>
            , the tool handler doesn&rsquo;t just return text to Claude &mdash;
            it also pushes the circuit DSL to the browser over WebSocket:
          </p>

          <CodeBlock title="packages/mcp/src/tools/show.ts" language="typescript">
{`// When Claude calls show_circuit, two things happen:

// 1. Push the DSL to the browser via WebSocket
studio.updateDSL(dslSource, sessionId);

// 2. Return a text summary to Claude
return { content: [{ type: "text", text: "Circuit displayed" }] };`}
          </CodeBlock>

          <p>
            On the browser side, a React hook connects to the WebSocket server
            and dispatches incoming messages to the right handlers:
          </p>

          <CodeBlock title="apps/tanstack/src/hooks/useMCPConnection.ts" language="typescript">
{`const { status, sendToClaudePrompt } = useMCPConnection({
  // Claude pushes new DSL → update the editor
  onDSL: (source) => dslEditorRef.current?.setCode(source),

  // Claude pushes waveforms → render in trace viewer
  onTraces: (data) => setTraces(data),

  // Claude pushes test results → show pass/fail
  onTestResults: (data) => setTestResults(data),

  // Claude sends a chat message → display in chat panel
  onChatMessage: (text) => addMessage({ role: "claude", text }),

  // MCP server requests current state → respond
  getCircuitState: () => ({
    cycleCount: sim.cycle,
    inputs: currentInputs,
    outputs: currentOutputs,
  }),
});`}
          </CodeBlock>

          <p>
            This creates a live feedback loop. Claude can push code into the
            editor, the browser compiles and simulates it, and Claude can query
            the results &mdash; all while the user watches it happen in real time.
          </p>
        </div>
      </div>
    </section>
  );
}
