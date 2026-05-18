export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          Adders
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          {/* TODO: one-sentence concept definition. Something like:
              "How digital circuits add two numbers — starting from a single XOR
              gate, ending with why the obvious design gets slower the wider
              your inputs are." */}
          How digital circuits add two numbers &mdash; starting from a single
          XOR gate, ending with why the obvious design gets slower the wider
          your inputs are.
        </p>
      </div>
    </section>
  );
}
