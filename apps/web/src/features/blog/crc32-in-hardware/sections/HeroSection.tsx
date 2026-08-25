export function HeroSection() {
  return (
    <section className="py-16">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800/50">
          Networking
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">~15 nodes</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">&bull;</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          Interactive tutorial &bull; ~8 min read
        </span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
        CRC-32 in Hardware
      </h1>

      <p className="text-lg text-gray-500 dark:text-gray-300 leading-relaxed mb-4">
        The 4-byte checksum at the end of every Ethernet frame, ZIP file, and NVMe command, computed
        by a 32-bit shift register with XOR feedback taps running at line rate in the NIC on your
        machine right now.
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
        CRC-32 is not magic. It&rsquo;s a{' '}
        <strong className="text-gray-900 dark:text-white">linear feedback shift register</strong>:{' '}
        32 flip-flops in a chain, with certain outputs XOR&rsquo;d back into the input. The specific
        XOR positions are defined by the Ethernet polynomial 0x04C11DB7. Every 1-bit in that 32-bit
        constant is a wire from a flip-flop output back into the chain.
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
        In this post, you&rsquo;ll build a 4-bit LFSR, understand how the polynomial defines the
        wiring, and watch the CRC-32 accumulator process bytes one at a time, the same operation
        your NIC performs at 25 Gbps.
      </p>
    </section>
  );
}
