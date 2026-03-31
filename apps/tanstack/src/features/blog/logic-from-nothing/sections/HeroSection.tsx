"use client";

export function HeroSection() {
  return (
    <section className="py-16">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800/50">
          Interactive
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500">&bull;</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">Build as you read &bull; ~15 min</span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
        Logic from Nothing
      </h1>

      <p className="text-lg text-gray-500 dark:text-gray-300 leading-relaxed mb-4">
        Every computer ever built &mdash; every phone, every server, every GPU &mdash;
        is constructed from one gate: <strong>NAND</strong>. Not AND. Not OR.
        Just NAND. From this single operation, you can build everything.
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
        This isn&rsquo;t a passive article. You&rsquo;ll build NOT, AND, OR,
        and XOR from nothing but NAND gates, writing real circuit descriptions
        that compile and simulate in your browser. Each section unlocks when
        you pass the challenge.
      </p>
      <p className="text-gray-500 text-sm leading-relaxed">
        Stuck? Every challenge has hints. No shame in using them &mdash; this
        is how you learn.
      </p>
    </section>
  );
}
