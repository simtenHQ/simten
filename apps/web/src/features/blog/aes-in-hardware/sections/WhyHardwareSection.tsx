
export function WhyHardwareSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Why AES-NI Exists
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          One AES-128 round applies all four steps — SubBytes, ShiftRows,
          MixColumns, AddRoundKey — to a 128-bit state. Then you do it nine
          more times, plus a final round. In software on a general-purpose CPU,
          each round requires:
        </p>
        <ul className="text-gray-600 dark:text-gray-300 space-y-2 ml-4">
          <li className="flex gap-2">
            <span className="text-gray-500 mt-1">–</span>
            <span>16 table lookups for SubBytes (memory dependent, cache-pressure)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-500 mt-1">–</span>
            <span>16 byte-level rotations for ShiftRows</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-500 mt-1">–</span>
            <span>64 GF(2<sup>8</sup>) multiplications and 48 XORs for MixColumns</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-500 mt-1">–</span>
            <span>16 XORs for AddRoundKey</span>
          </li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That&rsquo;s hundreds of operations per round, ten rounds per block,
          and a timing side channel if the S-box lookups hit different cache
          lines for different key bytes. A table-based software AES is fast
          enough, but it&rsquo;s not <em>safe enough</em> without constant-time
          mitigation.
        </p>

        <div className="rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            What AES-NI Actually Does
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Intel&rsquo;s <code>AESENC</code> instruction, introduced in 2010,
            performs one full AES round in a single clock cycle. The S-box
            becomes a hardware lookup with no memory traffic. ShiftRows is
            just wiring. MixColumns uses dedicated GF(2<sup>8</sup>) multiplier
            circuits. The entire datapath is constant-time by construction —
            there are no branches, no memory accesses, no cache lines to leak.
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Modern AES-NI pipelines the ten rounds with 3&ndash;4 cycle
            latency, achieving 1&ndash;2 clock cycles per byte of throughput.
            On a 3 GHz core that&rsquo;s roughly 10&ndash;20 GB/s — fast
            enough that TLS overhead is effectively zero on any server with a
            modern CPU.
          </p>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The contrast with ChaCha20 is stark. ChaCha20 was designed to be
          fast <em>without</em> hardware — its ARX operations (add, rotate,
          XOR) are cheap on any CPU. AES was designed for hardware from day
          one, and performs poorly without it. This is why Cloudflare and
          others deploy ChaCha20-Poly1305 for clients that lack AES-NI
          (older mobile devices, IoT) while defaulting to AES-GCM everywhere
          else.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The MixColumns circuit you just built is the exact computation that
          AES-NI performs in dedicated silicon — minus the pipelining and the
          parallel SubBytes lookup. In a real ASIC implementation, you&rsquo;d
          unroll all ten rounds and instantiate four MixColumn blocks in
          parallel (one per column), giving you a fully pipelined
          single-cycle AES core.
        </p>
      </div>
    </section>
  );
}
