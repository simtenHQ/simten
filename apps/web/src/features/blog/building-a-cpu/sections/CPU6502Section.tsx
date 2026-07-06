import { lazy, Suspense } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

const CPU6502Demo = lazy(() => import('../CPU6502Demo').then((m) => ({ default: m.CPU6502Demo })));

function CPU6502DemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading 6502 CPU simulator...</span>
      </div>
    </div>
  );
}

export function CPU6502Section() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The 6502: A Real CPU
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; gates, adders, registers, counters, and an ALU
          &mdash; are the building blocks of a real processor. The{' '}
          <strong className="text-gray-900 dark:text-white">MOS 6502</strong> (1975) powered the
          Apple II, Commodore 64, and NES. It has just 3,510 transistors and an elegant instruction
          set. Its ALU is wider (8 bits), its program counter longer (16 bits), and it has a control
          unit that decodes 56&nbsp;instructions &mdash; but the pieces are the same.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Below is a complete 6502 system simulated at the gate level &mdash; over 5,500 lines of
          TypeScript, compiled and running in your browser. It has a CPU, RAM, ROM, and a
          memory-mapped console output at address <code className="text-blue-300">$F000</code>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The ROM is pre-loaded with C programs compiled with{' '}
          <a
            href="https://cc65.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            cc65
          </a>
          , a C compiler targeting the 6502. Click <strong>Run</strong> to watch the CPU execute
          real compiled C code, one cycle at a time.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<CPU6502DemoLoader />}>
          <Suspense fallback={<CPU6502DemoLoader />}>
            <CPU6502Demo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          What you just saw is the same process that happens billions of times per second in the
          device you&rsquo;re reading this on. A clock ticks. The program counter increments. An
          instruction is fetched from memory. The control unit decodes it. The ALU computes. Results
          are stored. Repeat.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The only difference between this 6502 and a modern CPU is scale: more transistors, wider
          buses, deeper pipelines, more cache. But the fundamentals &mdash; NAND gates all the way
          down &mdash; haven&rsquo;t changed.
        </p>
      </div>
    </section>
  );
}
