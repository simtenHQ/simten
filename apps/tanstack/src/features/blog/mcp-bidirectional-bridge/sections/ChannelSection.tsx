"use client";

function FlowDiagram() {
  return (
    <div className="my-8 rounded-xl border border-gray-800 bg-[#0d1117] p-6 md:p-8 overflow-x-auto">
      <pre className="text-sm md:text-base font-mono text-gray-300 leading-relaxed whitespace-pre">
        {`User types "How do I connect the carry bit?"
  in the browser challenge chat
            │
            ▼
Browser sends WebSocket message:
  { type: "send-to-claude",
    content: "How do I connect the carry bit?",
    meta: { type: "challenge_prompt",
            challenge_id: "build-an-alu",
            level_id: "full-adder" } }
            │
            ▼
MCP server receives, fires channel notification:
  rawServer.notification({
    method: "notifications/claude/channel",
    params: { content, meta }
  })
            │
            ▼
Claude receives the notification with full context:
  <channel source="turing-incomplete"
           type="challenge_prompt"
           challenge_id="build-an-alu"
           level_id="full-adder">
  How do I connect the carry bit?
  </channel>
            │
            ▼
Claude calls push_chat_response tool:
  "The carry output from the first half-adder
   needs to OR with the carry from the second..."
            │
            ▼
MCP server pushes to browser:
  { type: "chat-message", text: "The carry output..." }
            │
            ▼
Browser renders Claude's response in the chat panel`}
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

export function ChannelSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          Channel Notifications: Browser&nbsp;&rarr;&nbsp;Claude
        </h2>

        <div className="space-y-5 text-gray-300 leading-relaxed">
          <p>
            Standard MCP is pull-based: Claude calls a tool, the server
            responds. But what about the other direction? What if the{" "}
            <em>user in the browser</em> wants to send a message to Claude?
          </p>

          <p>
            This is where{" "}
            <strong className="text-white">channel notifications</strong> come
            in &mdash; an experimental MCP capability that lets the server push
            unsolicited notifications to the LLM client. We declare the
            capability when creating the server:
          </p>

          <CodeBlock title="packages/mcp/src/index.ts" language="typescript">
{`const server = new McpServer({
  name: "turing-incomplete",
  version: "1.0.0",
}, {
  capabilities: {
    experimental: { "claude/channel": {} },
  },
});`}
          </CodeBlock>

          <p>
            With this enabled, the MCP server can fire notifications to Claude at
            any time &mdash; not just in response to tool calls. We use this to
            forward user prompts from the browser chat:
          </p>

          <FlowDiagram />

          <p>
            The metadata is critical. When Claude receives the channel
            notification, it knows{" "}
            <em>which challenge, which level, and what the user is working on</em>
            . It can call{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              get_circuit_state
            </code>{" "}
            to read the live simulation, formulate a contextual response, and
            push it back to the browser chat via{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              push_chat_response
            </code>
            .
          </p>

          <p>
            The user never leaves the browser. They don&rsquo;t need Claude Code
            open. They just type in the chat, and Claude responds with full
            awareness of what they&rsquo;re building.
          </p>
        </div>
      </div>
    </section>
  );
}
