
export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          ChaCha20 in Hardware
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          AES needs dedicated CPU instructions to run fast. ChaCha20 was
          designed to need nothing special &mdash; just addition, XOR, and
          bit rotation, repeated 80 times, on any hardware that exists.
          The irony: that simplicity makes it unusually elegant in silicon too.
        </p>
        <p className="mt-4 text-gray-500 dark:text-gray-400 leading-relaxed">
          Build the core quarter-round from logic gates, verify it against the
          RFC 7539 test vector, and see why a cipher designed to escape hardware
          ends up being one of the cleanest things you can build in gates.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~8 min read</span>
          <span className="text-gray-600">/</span>
          <span>
            Built with{" "}
            <a href="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Simten
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
