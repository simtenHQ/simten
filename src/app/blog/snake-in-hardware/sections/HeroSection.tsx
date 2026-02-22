"use client";

export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
          Snake in Hardware
        </h1>
        <p className="mt-6 text-xl text-gray-300 leading-relaxed">
          A complete Snake game built entirely from logic gates, registers, and
          memory &mdash; no CPU, no software, just digital circuits. Watch a
          hardware-only game come alive in your browser.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~12 min read</span>
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
