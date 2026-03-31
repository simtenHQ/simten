"use client";

export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          Computing Trig in Hardware
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          Every calculator, GPU, and DSP chip computes sine and cosine without
          a multiplier &mdash; using an algorithm called CORDIC that needs
          nothing more than bit shifts and addition. Build one from logic gates
          and watch it converge in your browser.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~10 min read</span>
          <span className="text-gray-600">/</span>
          <span>
            Built with{" "}
            <a href="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Turing Incomplete
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
