
export function VerifySection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Verifying Against the Standard
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The canonical CRC-32 test vector is the ASCII string{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">&quot;123456789&quot;</code>
          . Every correct CRC-32 implementation must produce{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-orange-400">0xCBF43926</code>
          . This is how you know your hardware matches the spec that governs every
          Ethernet chip in the world.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          You can verify this from the Simten editor using the{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">crc-32</code>
          {" "}npm package. Paste the following into the editor on any page:
        </p>

        <div className="rounded-lg bg-gray-900 border border-gray-700/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
            <span className="text-xs font-mono text-gray-500">editor</span>
            <span className="text-xs text-gray-600">paste into Simten editor</span>
          </div>
          <pre className="p-4 text-sm font-mono overflow-x-auto leading-relaxed">
            <span className="text-gray-500">// CRC-32 test vector: "123456789" → 0xCBF43926</span>{"\n"}
            <span className="text-blue-400">import</span>
            {" "}CRC32{" "}
            <span className="text-blue-400">from</span>
            {" "}
            <span className="text-green-400">&apos;crc-32&apos;</span>
            {";\n\n"}
            <span className="text-gray-500">// The standard test vector</span>{"\n"}
            <span className="text-blue-400">const</span>
            {" result = CRC32."}
            <span className="text-yellow-400">str</span>
            {"("}
            <span className="text-green-400">&quot;123456789&quot;</span>
            {");\n"}
            {"console."}
            <span className="text-yellow-400">log</span>
            {"((result >>> 0)."}
            <span className="text-yellow-400">toString</span>
            {"(16)); "}
            <span className="text-gray-500">// cbf43926</span>{"\n\n"}
            <span className="text-gray-500">// Verify individual bytes</span>{"\n"}
            <span className="text-blue-400">const</span>
            {" bytes = [49, 50, 51, 52, 53, 54, 55, 56, 57]; "}
            <span className="text-gray-500">// "1" through "9"</span>{"\n"}
            {"console."}
            <span className="text-yellow-400">log</span>
            {"(bytes."}
            <span className="text-yellow-400">map</span>
            {"(b => String."}
            <span className="text-yellow-400">fromCharCode</span>
            {"(b))."}
            <span className="text-yellow-400">join</span>
            {"("}
            <span className="text-green-400">&apos;&apos;</span>
            {")); "}
            <span className="text-gray-500">// 123456789</span>{"\n"}
          </pre>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">&gt;&gt;&gt; 0</code>
          {" "}converts the signed 32-bit JavaScript integer to an unsigned value before
          converting to hex. CRC-32 is always an unsigned 32-bit number; JavaScript
          &rsquo;s bitwise operators work on signed 32-bit integers, so the coercion
          is necessary to print it correctly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-mono">
          {[
            { input: '"123456789"', crc: "0xCBF43926", label: "Standard test vector" },
            { input: '"" (empty)', crc: "0x00000000", label: "Empty string" },
            { input: '"a"', crc: "0xE8B7BE43", label: "Single character" },
          ].map(({ input, crc, label }) => (
            <div
              key={input}
              className="bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50 rounded p-3"
            >
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">{label}</div>
              <div className="text-gray-900 dark:text-white text-xs">{input}</div>
              <div className="text-gray-500 text-xs mt-2 mb-1">CRC-32</div>
              <div className="text-orange-400">{crc}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Where you&rsquo;ll find CRC-32 in the wild
          </h3>
          <ul className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
            <li>
              <strong className="text-gray-900 dark:text-gray-300">Ethernet frames</strong>
              {" "}&mdash; the 4-byte FCS (Frame Check Sequence) field at the end of every packet
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-300">ZIP archives</strong>
              {" "}&mdash; stored in the local file header and central directory for each file
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-300">PNG images</strong>
              {" "}&mdash; each chunk ends with a CRC-32 of the chunk type and data
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-300">NVMe / SATA</strong>
              {" "}&mdash; every sector has a CRC computed in the drive controller before
              writing to flash
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-300">gzip / zlib</strong>
              {" "}&mdash; the checksum appended to compressed streams
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
