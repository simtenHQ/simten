
export function HeroSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          How Network Switches Work
        </h1>
        <p className="mt-6 text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          Every time you open a web page, packets race through network switches
          that parse Ethernet frames, buffer data, arbitrate between ports, and
          route bytes to their destination &mdash; all in hardware, billions of
          times per second. Here we build one from scratch.
        </p>
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~15 min read</span>
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
