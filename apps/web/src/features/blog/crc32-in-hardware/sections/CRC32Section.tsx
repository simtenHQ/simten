import { useCircuitSimulator } from '@simten/embed';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CRC32ByteDemo } from '../circuits';

// CRC-32 software reference for verification display
// Uses the reflected polynomial 0xEDB88320
function crc32Byte(crc: number, byte: number): number {
  let c = (crc ^ byte) & 0xff;
  for (let i = 0; i < 8; i++) {
    c = c & 1 ? 0xed ^ (c >>> 1) : c >>> 1;
  }
  return c & 0xff;
}

function CRC32DemoInner() {
  const sim = useCircuitSimulator(CRC32ByteDemo);
  const [dataInput, setDataInput] = useState('49'); // ASCII '1'
  const [cycleCount, setCycleCount] = useState(0);
  const [softwareCRC, setSoftwareCRC] = useState(0xff);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read the current CRC output from portValues
  const currentCRC = (() => {
    if (!sim.portValues) return 0;
    const v = sim.portValues.get('display.in');
    if (v !== undefined && typeof v === 'number') return v;
    for (const [key, value] of sim.portValues) {
      if (key.includes('display') && typeof value === 'number') return value;
    }
    return 0;
  })();

  const handleStep = useCallback(() => {
    const byteVal = Math.max(0, Math.min(255, parseInt(dataInput, 10) || 0));
    sim.setNodeValue?.('data', byteVal);
    sim.tick();
    setCycleCount((c) => c + 1);
    setSoftwareCRC((prev) => crc32Byte(prev, byteVal));
  }, [sim, dataInput]);

  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sim.reset();
    setCycleCount(0);
    setSoftwareCRC(0xff);
    setDataInput('49');
  }, [sim]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling CRC-32 circuit...</span>
        </div>
      </div>
    );
  }

  if (sim.error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6">
        <div className="text-red-400 text-sm font-mono">{sim.error}</div>
      </div>
    );
  }

  const byteVal = Math.max(0, Math.min(255, parseInt(dataInput, 10) || 0));

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
      {/* Status header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Running CRC
            </span>
            <div className="font-mono text-gray-900 dark:text-gray-300 mt-1 flex gap-4 flex-wrap">
              <span>
                Hardware CRC (low byte):{' '}
                <span className="text-blue-400">
                  0x{currentCRC.toString(16).toUpperCase().padStart(2, '0')}
                </span>
              </span>
              <span>
                Software CRC (low byte):{' '}
                <span className="text-emerald-400">
                  0x{softwareCRC.toString(16).toUpperCase().padStart(2, '0')}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Data Byte (0&ndash;255)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={255}
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                className="w-20 px-2 py-1.5 text-sm font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                = 0x{byteVal.toString(16).toUpperCase().padStart(2, '0')}
              </span>
              {byteVal >= 32 && byteVal < 127 && (
                <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                  = &apos;{String.fromCharCode(byteVal)}&apos;
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStep}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Step (process byte)
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            >
              Reset
            </button>
          </div>

          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums ml-auto">
            Bytes processed: {cycleCount}
          </span>
        </div>

        {/* Quick-feed test vector */}
        <div className="text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700/50 pt-3">
          <span className="font-medium text-gray-600 dark:text-gray-400">
            Standard test vector:{' '}
          </span>
          Feed bytes 49&ndash;57 (ASCII &ldquo;1&rdquo;&ndash;&ldquo;9&rdquo;) one at a time, then
          XOR the final 32-bit state with 0xFFFFFFFF. The result should be 0xCBF43926.
        </div>
      </div>
    </div>
  );
}

export function CRC32Section() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The CRC-32 Accumulator
      </h2>
      <div className="prose-invert space-y-6 mb-8">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The standard CRC-32 algorithm processes one byte per clock cycle. Each byte is XOR&rsquo;d
          into the low 8 bits of the running CRC register, then shifted through 8 rounds of the
          polynomial feedback. The result becomes the new register state for the next byte.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit below shows one byte-step of CRC-32 with a register accumulating the state.
          Change the data byte and click <strong>Step</strong> to process it. The register&rsquo;s
          initial value is 0xFF (truncated from the standard 0xFFFFFFFF init for the 8-bit demo).
          After all bytes of a message are processed, the final CRC state is XOR&rsquo;d with
          0xFFFFFFFF to produce the checksum you&rsquo;d find in the Ethernet FCS field.
        </p>
      </div>

      <CRC32DemoInner />

      <div className="mt-8 rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Why one byte per cycle?
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Processing one bit at a time would mean 8 cycles per byte, which is too slow for
          multi-gigabit links. Modern NICs unroll the LFSR computation: instead of shifting 8 times
          sequentially, the hardware precomputes the effect of all 8 polynomial shifts in parallel
          and produces the result in a single clock cycle. At 100 Gbps, a NIC must compute CRC-32
          over roughly 12.5 billion bytes per second. The unrolled hardware does exactly that with a
          fixed amount of combinational logic &mdash; no loops, no branches.
        </p>
      </div>
    </section>
  );
}
