
export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          MCP as a Real-Time Bridge Between AI&nbsp;Agents and Web&nbsp;Apps
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          Most MCP servers are stateless tool bags &mdash; a search tool here, a
          database query there. But MCP can be something more: a real-time,
          bidirectional nervous system that lets an AI agent observe, mutate, and
          respond to a live web application. Here&rsquo;s how we built it.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Technical deep-dive</span>
          <span className="text-gray-600">/</span>
          <span>~12 min read</span>
          <span className="text-gray-600">/</span>
          <span>
            Built with{" "}
            <a
              href="/"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Simten
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
