"use client";

export function PatternSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          The General Pattern
        </h2>

        <div className="space-y-5 text-gray-300 leading-relaxed">
          <p>
            This isn&rsquo;t specific to circuit simulators. The pattern
            generalizes to any application where an AI agent needs to be a
            live participant, not just an offline tool:
          </p>

          <div className="my-8 space-y-4">
            {[
              {
                app: "Collaborative design tools",
                push: "AI pushes layout suggestions directly onto the canvas",
                pull: "AI reads current component tree and style state",
              },
              {
                app: "Game development",
                push: "AI pushes NPC behavior scripts, tweaks physics params",
                pull: "AI reads live game state, player positions, frame timing",
              },
              {
                app: "Data dashboards",
                push: "AI pushes new chart configs, filter presets, annotations",
                pull: "AI reads current query results, visible data range",
              },
              {
                app: "Music production",
                push: "AI pushes MIDI patterns, effect chains, mix adjustments",
                pull: "AI reads current track state, waveform analysis, BPM",
              },
            ].map((example, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-[#0d1117] p-5"
              >
                <h3 className="text-sm font-semibold text-white mb-3">
                  {example.app}
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 font-mono text-xs mt-0.5 shrink-0">
                      PUSH
                    </span>
                    <span className="text-gray-400">{example.push}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-mono text-xs mt-0.5 shrink-0">
                      PULL
                    </span>
                    <span className="text-gray-400">{example.pull}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p>
            The recipe is the same in every case:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-gray-300 pl-1">
            <li>
              Build an MCP server that exposes domain-specific tools
            </li>
            <li>
              Add a WebSocket bridge in the same process for real-time browser
              communication
            </li>
            <li>
              Use channel notifications for browser &rarr; AI messaging
            </li>
            <li>
              Use a pull model with request IDs for AI &rarr; browser state
              queries
            </li>
            <li>
              Let the user bring their own Claude (or any MCP-compatible client)
            </li>
          </ol>

          <p>
            The MCP server becomes the real-time nervous system of your
            application &mdash; the bridge between human intent, AI reasoning,
            and live application state.
          </p>
        </div>
      </div>
    </section>
  );
}
