import { Link } from '@tanstack/react-router';

export function HeroSection() {
  return (
    <section className="py-16">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-900/50 text-violet-400 border border-violet-800/50">
          Accelerator
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">~60 nodes</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">&bull;</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          Interactive tutorial &bull; ~10 min read
        </span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
        AES in Hardware
      </h1>

      <p className="text-lg text-gray-500 dark:text-gray-300 leading-relaxed mb-4">
        AES-GCM encrypts roughly 80% of HTTPS traffic today. It&rsquo;s so ubiquitous that Intel,
        AMD, and ARM all built dedicated silicon to accelerate it: <strong>AES-NI</strong>, a set of
        CPU instructions that do one full round in a single clock cycle.
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
        Why does AES need hardware help when something like{' '}
        <Link
          to="/blog/chacha20-in-hardware"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          ChaCha20
        </Link>{' '}
        doesn&rsquo;t? Because AES is genuinely complex at the gate level. One round requires a
        256-entry lookup table (the S-box), Galois field multiplication, and multiple layers of XOR
        mixing. Without dedicated silicon, it&rsquo;s slow <em>and</em> vulnerable to cache-timing
        attacks.
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
        In this post, you&rsquo;ll build the three hardware operations that make up one AES round
        (SubBytes, XTime, the GF(2<sup>8</sup>) multiply at the heart of MixColumns, and the full
        MixColumns step), and verify each against the FIPS 197 test vectors.
      </p>
    </section>
  );
}
