export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          Pong in Hardware
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          Two paddles, a bouncing ball, and a 14-phase rendering pipeline, all built from logic
          gates, registers, and memory. No CPU runs this game. Every decision is wired directly into
          the circuit.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~10 min read</span>
          <span className="text-gray-600">/</span>
          <span>
            Built with{' '}
            <a href="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Simten
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
