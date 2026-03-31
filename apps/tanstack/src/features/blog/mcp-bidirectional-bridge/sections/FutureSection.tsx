"use client";

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

export function FutureSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Going Remote: MCP at the&nbsp;Edge
        </h2>

        <div className="space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            The local architecture works well for a single user, but has
            inherent limits: one machine, one Claude instance, requires a local
            install. A remote MCP server changes the equation.
          </p>

          <p>
            Cloudflare Workers already supports hosting remote MCP servers via
            the{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              @cloudflare/agents
            </code>{" "}
            package and streamable HTTP transport. The local WebSocket bridge
            maps naturally onto their primitives:
          </p>

          <div className="my-8 space-y-3">
            {[
              {
                local: "In-memory session map",
                remote: "Durable Object per session",
                why: "Persistent state, WebSocket hibernation, survives redeploys",
              },
              {
                local: "Module-level singleton",
                remote: "Durable Object with WebSocket + MCP",
                why: "Same object handles both browser connections and MCP tool calls",
              },
              {
                local: "Cached DSL/traces in memory",
                remote: "KV or D1 for persistent state",
                why: "Late joiners get state even if the DO has hibernated",
              },
              {
                local: "localhost token auth",
                remote: "Cloudflare Access or OAuth",
                why: "Multi-tenant authentication without rolling your own",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-[#0d1117] p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 font-mono">Local:</span>
                      <span className="text-gray-500 dark:text-gray-400">{row.local}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className="text-blue-500 font-mono">Edge:</span>
                      <span className="text-blue-300">{row.remote}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">{row.why}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p>
            A remote MCP server unlocks capabilities that local can&rsquo;t
            touch: multi-user classrooms where a teacher&rsquo;s Claude observes
            all students, persistent progress across sessions, and no local
            install required &mdash; users just add a URL to their Claude
            config.
          </p>

          <CodeBlock title="claude_desktop_config.json" language="json">
{`{
  "mcpServers": {
    "turing-incomplete": {
      "url": "https://mcp.turing-incomplete.com/sse",
      "transport": "sse"
    }
  }
}`}
          </CodeBlock>

          <p>
            The economics stay the same. The user still brings their own Claude.
            You still pay zero for AI. But now your tool server scales to
            thousands of concurrent users on edge infrastructure, with
            persistent state and proper auth &mdash; and the bidirectional
            bridge works exactly as before.
          </p>
        </div>
      </div>
    </section>
  );
}
