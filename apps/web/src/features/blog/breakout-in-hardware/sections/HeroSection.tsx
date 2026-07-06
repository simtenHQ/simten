export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          Breakout in Hardware
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          A complete Breakout game built entirely from logic gates, registers, and memory &mdash; a
          6-pixel paddle, a bouncing ball, and 128 destructible bricks, drawn by a combinational
          raster scan the way a real display works. No CPU, no software, just digital circuits.
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

        {/* Original Breakout — Wozniak's hardware implementation */}
        <div className="mt-10">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
            Steve Wozniak built the original Breakout in hardware for Atari in 1976 &mdash; no CPU,
            just TTL chips. Here&rsquo;s what it looked like:
          </p>
          <div className="aspect-video rounded-xl overflow-hidden border border-gray-700/50">
            <iframe
              src="https://www.youtube.com/embed/17eUExffa5w"
              title="Original Breakout — Atari 1976"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
