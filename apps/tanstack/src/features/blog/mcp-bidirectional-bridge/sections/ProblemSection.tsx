
export function ProblemSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          The Problem: AI That Can&rsquo;t See Your App
        </h2>

        <div className="space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            When you use Claude Code or Cursor to build a web app, the AI can
            read your files and run your tests. But it can&rsquo;t see
            what&rsquo;s happening in the browser. It doesn&rsquo;t know the
            current state of your UI, can&rsquo;t push changes to a running
            application, and has no way to receive messages from your app&rsquo;s
            users.
          </p>

          <p>
            For most development work, this is fine. But for{" "}
            <strong className="text-gray-900 dark:text-white">
              interactive, AI-native applications
            </strong>{" "}
            &mdash; where the AI is a participant in the running app, not just
            the author of its source code &mdash; you need a live connection.
          </p>

          <p>
            Turing Incomplete is a browser-based hardware design tool. Users
            build circuits visually, and an AI tutor helps them learn. The AI
            needs to:
          </p>

          <ul className="list-none space-y-3 pl-0">
            {[
              "See the current circuit state (what gates are connected, what values are on the wires)",
              "Push corrected DSL code directly into the browser editor",
              "Send waveforms and test results to the browser for visualization",
              "Receive questions from the in-app chat and respond in context",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p>
            None of this is possible with a standard MCP server that just
            exposes tools and waits for calls. We needed something bidirectional.
          </p>
        </div>
      </div>
    </section>
  );
}
