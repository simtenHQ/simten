
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
    <div className="my-6 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-200 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{title}</span>
        <span className="text-[10px] text-gray-500 dark:text-gray-600 font-mono uppercase">
          {language}
        </span>
      </div>
      <pre className="p-4 bg-[#0d1117] overflow-x-auto">
        <code className="text-sm font-mono text-gray-500 dark:text-gray-300 leading-relaxed">
          {children}
        </code>
      </pre>
    </div>
  );
}

export function StateSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Pull Model: Claude Reads Live App&nbsp;State
        </h2>

        <div className="space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            Pushing data <em>to</em> the browser is half the story. Claude also
            needs to <em>read</em> live state from the running application. We
            implement this with a request/response pattern over the same
            WebSocket connection.
          </p>

          <p>
            When Claude calls a tool like{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              check_challenge_progress
            </code>{" "}
            without providing the circuit source, the MCP server asks the
            browser for it:
          </p>

          <CodeBlock
            title="packages/mcp/src/server/ws-server.ts"
            language="typescript"
          >
{`async getState(sessionId?: string): Promise<CircuitState | null> {
  const ws = this.getSession(sessionId);
  if (!ws) return null;

  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    // 3-second timeout if browser doesn't respond
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(requestId);
      resolve(null);
    }, 3000);

    this.pendingRequests.set(requestId, { resolve, timeout });
    send(ws, { type: "request-state", requestId });
  });
}`}
          </CodeBlock>

          <p>
            The browser receives the request and responds with its current
            state &mdash; input values, output values, cycle count, circuit name:
          </p>

          <CodeBlock
            title="apps/tanstack/src/hooks/useMCPConnection.ts"
            language="typescript"
          >
{`// MCP server asks for state → browser responds
if (msg.type === "request-challenge-state") {
  ws.send(JSON.stringify({
    type: "challenge-state-response",
    requestId: msg.requestId,
    state: {
      challengeId: currentChallenge.id,
      levelId: currentLevel.id,
      userSource: editor.getCode(),  // Current circuit code in editor
    },
  }));
}`}
          </CodeBlock>

          <p>
            This is subtle but powerful. Claude doesn&rsquo;t need the user to
            copy-paste their code. It doesn&rsquo;t read files from disk. It
            pulls the{" "}
            <strong className="text-gray-900 dark:text-white">live, in-memory state</strong> of the
            running application &mdash; the exact circuit code the user is editing right
            now, the exact values on the wires after the last simulation tick.
          </p>

          <div className="mt-8 rounded-xl border border-amber-900/50 bg-amber-950/20 p-5">
            <p className="text-sm text-amber-200/80 leading-relaxed">
              <strong className="text-amber-200">Design note:</strong> We use a
              3-second timeout with a{" "}
              <code className="text-amber-300/80 bg-amber-400/10 px-1 py-0.5 rounded text-xs">
                pendingRequests
              </code>{" "}
              map keyed by request ID. If the browser tab is closed or
              unresponsive, the tool gracefully returns null instead of hanging.
              Multiple concurrent requests are supported &mdash; each gets a
              unique ID.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
