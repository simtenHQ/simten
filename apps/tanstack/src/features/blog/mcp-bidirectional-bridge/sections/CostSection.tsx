"use client";

export function CostSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Zero API Cost: The User Brings Their Own&nbsp;AI
        </h2>

        <div className="space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            There&rsquo;s an often-overlooked consequence of this architecture:
            the app developer pays for{" "}
            <strong className="text-gray-900 dark:text-white">zero AI API calls</strong>.
          </p>

          <p>
            The MCP server is a tool provider, not an AI provider. It gives
            Claude capabilities (inspect circuits, push code, check progress)
            but the inference happens on the user&rsquo;s own Claude
            subscription. The user pays Anthropic directly. The app developer
            pays nothing.
          </p>

          <div className="my-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-3">
                Traditional AI-powered app
              </h3>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#x2717;</span>
                  <span>Developer pays per API call</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#x2717;</span>
                  <span>Needs billing, rate limiting, cost controls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#x2717;</span>
                  <span>API key management and rotation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#x2717;</span>
                  <span>Margin pressure as usage grows</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] p-5">
              <h3 className="text-sm font-semibold text-green-400 mb-3">
                MCP bridge approach
              </h3>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#x2713;</span>
                  <span>User pays their own Claude subscription</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#x2713;</span>
                  <span>No billing infrastructure needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#x2713;</span>
                  <span>No API keys in your backend</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#x2713;</span>
                  <span>Costs scale with users, not with you</span>
                </li>
              </ul>
            </div>
          </div>

          <p>
            This inverts the economics of AI-native apps. Instead of every
            feature with AI increasing your cost per user, the AI capability is
            essentially free to provide. You build the tools, the user brings
            the intelligence.
          </p>
        </div>
      </div>
    </section>
  );
}
