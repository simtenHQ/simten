
export function PolynomialSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Polynomial Is the Wiring Diagram
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The CRC-32 polynomial is usually written as{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">0x04C11DB7</code>
          {" "}in normal form, or{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">0xEDB88320</code>
          {" "}in reflected (bit-reversed) form. Both represent the same mathematical object
          &mdash; a degree-32 polynomial over GF(2):
        </p>

        <div className="rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 font-mono text-sm overflow-x-auto">
          <div className="text-gray-900 dark:text-white mb-2">x<sup>32</sup> + x<sup>26</sup> + x<sup>23</sup> + x<sup>22</sup> + x<sup>16</sup> + x<sup>12</sup> + x<sup>11</sup> + x<sup>10</sup> + x<sup>8</sup> + x<sup>7</sup> + x<sup>5</sup> + x<sup>4</sup> + x<sup>2</sup> + x + 1</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">= 0x04C11DB7 (IEEE 802.3, Ethernet)</div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The key insight: <strong>each term x<sup>k</sup> corresponds to a wire.</strong>{" "}
          Wherever the polynomial has a 1-coefficient, there is an XOR gate connecting
          flip-flop k to the feedback path. Wherever it has a 0-coefficient, there is
          no connection.
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Look at the reflected polynomial in binary:
        </p>

        <div className="rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
          <div className="font-mono text-sm">
            <div className="text-gray-500 dark:text-gray-400 text-xs mb-2">0xEDB88320 in binary (reflected form, LSB = tap at bit 0):</div>
            <div className="text-gray-900 dark:text-white tracking-widest">
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">1</span>
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">0</span>
              {" "}
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">1</span>
              <span className="text-orange-400">0</span>
              <span className="text-orange-400">1</span>
              {" "}
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">0</span>
              <span className="text-orange-400">1</span>
              <span className="text-orange-400">1</span>
              {" "}
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              {" "}
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              {" "}
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">1</span>
              {" "}
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-orange-400">1</span>
              <span className="text-gray-400">0</span>
              {" "}
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
              <span className="text-gray-400">0</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Orange bits = XOR tap positions (where there&rsquo;s a feedback wire)
            </div>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Count the orange bits: there are 16 tap positions out of 32. Each one
          is a physical XOR gate in the NIC&rsquo;s CRC engine. The polynomial is
          literally the gate-level schematic.
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In a real NIC running at 25 Gbps, the CRC-32 engine is unrolled to process
          multiple bits per clock cycle &mdash; but the mathematics is identical.
          The hardware is fixed at tape-out; there are no microcode decisions, no
          branch predictions, no cache misses. Just wires and XOR gates, computing
          the polynomial remainder at the speed of light.
        </p>

        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">
            Why this specific polynomial?
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            For a CRC to reliably detect errors, the generator polynomial must be
            irreducible over GF(2). The IEEE 802.3 committee chose 0x04C11DB7 in 1975
            because it detects all single-bit errors, all double-bit errors, all odd
            numbers of errors, and all burst errors of 32 bits or fewer within a frame.
            Every Ethernet frame, ZIP archive, PNG image, and NVMe sector uses this
            exact same polynomial. It&rsquo;s been protecting your data for 50 years.
          </p>
        </div>
      </div>
    </section>
  );
}
