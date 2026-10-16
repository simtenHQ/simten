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
          Everything we&rsquo;ve built so far (gates, adders, registers, counters, and an ALU) makes
          up the building blocks of a real processor. The{' '}
          <strong className="text-gray-900 dark:text-white">MOS 6502</strong> (1975) powered the
          Apple II, Commodore 64, and NES. It has just 3,510 transistors and an elegant instruction
          set. Its ALU is wider (8 bits), its program counter longer (16 bits), and it has a control
          unit that decodes 56&nbsp;instructions in 151 opcode forms, but the pieces are the same.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Below is a complete 6502 computer running in your browser: the CPU, 2&nbsp;KB of RAM, a
          ROM, and a console you print to by writing a byte to address{' '}
          <code className="text-blue-300">$F000</code>. The CPU is built from the blocks of the real
          chip&rsquo;s block diagram (the program counter, ALU, registers and the four internal
          buses), and it is exact at the pins: every clock cycle puts the same address and data on
          the bus as a real 6502, down to its dummy reads and its decimal-mode quirks. It passes{' '}
          <a
            href="https://github.com/SingleStepTests/65x02"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Tom Harte&rsquo;s per-instruction tests
          </a>{' '}
          (1.5 million of them) and{' '}
          <a
            href="https://github.com/Klaus2m5/6502_65C02_functional_tests"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Klaus Dormann&rsquo;s
          </a>{' '}
          functional and decimal test programs.
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
          real compiled C code, or <strong>Edit Code</strong> to write your own and compile it right
          here.
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
          To see inside it,{' '}
          <a
            href="/circuit?example=6502-computer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            open the same computer in the circuit editor
          </a>
          . Step it one clock cycle at a time, then double-click the CPU to watch the decode PLA,
          the ALU and the buses change as each instruction runs.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          What you just saw is the same process that happens billions of times per second in the
          device you&rsquo;re reading this on. A clock ticks. The program counter increments. An
          instruction is fetched from memory. The control unit decodes it. The ALU computes. Results
          are stored. Repeat.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The only difference between this 6502 and a modern CPU is scale: more transistors, wider
          buses, deeper pipelines, more cache. But the fundamentals, NAND gates all the way down,
          haven&rsquo;t changed.
        </p>
      </div>
    </section>
  );
}
