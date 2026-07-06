export function BigPictureSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        From Quarter-Round to Full Cipher
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A full ChaCha20 block operates on a 4&times;4 matrix of 32-bit words &mdash; 512 bits of
          state. The matrix is initialized with four constants, an eight-word key, a counter, and a
          three-word nonce:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
          {`"expa"  "nd 3"  "2-by"  "te k"   ← constants
 key[0]  key[1]  key[2]  key[3]
 key[4]  key[5]  key[6]  key[7]
counter nonce[0] nonce[1] nonce[2]`}
        </pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each <strong>double-round</strong> applies the quarter-round to four columns, then four
          diagonals:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
          {`// Column round
QR(0, 4,  8, 12)  QR(1, 5,  9, 13)
QR(2, 6, 10, 14)  QR(3, 7, 11, 15)

// Diagonal round
QR(0, 5, 10, 15)  QR(1, 6, 11, 12)
QR(2, 7,  8, 13)  QR(3, 4,  9, 14)`}
        </pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Ten double-rounds (20 rounds total, 80 quarter-rounds) produce the final state. The
          original input is added back word-by-word &mdash; this makes the function non-invertible,
          a critical property for a stream cipher.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The quarter-round you built above is the <strong>only non-trivial building block</strong>.
          The rest is just wiring &mdash; choosing which four words from the matrix to feed into
          each QR call. In an ASIC or FPGA, you&rsquo;d instantiate 4 quarter-round blocks and
          pipeline them across 20 cycles, or unroll all 80 for single-cycle throughput at the cost
          of area.
        </p>

        <div className="rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Designed to Avoid Hardware — Elegant in Hardware Anyway
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Daniel Bernstein designed ChaCha20 in 2008 with a specific goal: a cipher that would be
            fast <em>without</em> dedicated hardware support. AES had just been blessed with AES-NI
            instructions on x86, but most of the world&rsquo;s devices &mdash; mobile phones, IoT
            chips, older ARM cores &mdash; had no such luxury. ChaCha20&rsquo;s ARX primitives (add,
            rotate, XOR) map to cheap, universally available instructions on any architecture, with
            no lookup tables and no timing side channels. That&rsquo;s why Cloudflare and others
            adopted ChaCha20-Poly1305 for TLS: it&rsquo;s the cipher that works fast in software on
            anything.
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mt-3">
            The interesting irony is what happens when you <em>do</em> put it in hardware anyway.
            The same simplicity that makes ChaCha20 fast in software &mdash; just three operations,
            repeated 80 times &mdash; turns out to make it unusually elegant in gates. Four adders,
            four XOR trees, four barrel shifters: that&rsquo;s the entire datapath. A cipher
            designed to escape the need for specialized hardware turns out to synthesize into some
            of the cleanest silicon you can build.
          </p>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          For comparison, AES was built for hardware from day one &mdash; and one round of AES
          requires a 256-entry lookup table (the S-box), Galois field multiplication, and multiple
          XOR trees just for the MixColumns step. That complexity is exactly why Intel had to build
          AES-NI into the CPU: without dedicated silicon, AES is slow
          <em> and</em> vulnerable to cache-timing attacks. ChaCha20 has no such baggage.
        </p>
      </div>
    </section>
  );
}
