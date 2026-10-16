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
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The 6502</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The <strong className="text-gray-900 dark:text-white">MOS 6502</strong> came out in 1975
          and ended up in the Apple II, the Commodore 64 and the NES. It has about 3,500
          transistors. Its ALU is 8&nbsp;bits wide and its program counter 16, and it understands 56
          instructions, which come in 151 variants once you count the different ways they can
          address memory.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Below is a small 6502 computer: the CPU, 2&nbsp;KB of RAM, a ROM, and a console that
          prints any byte written to address <code className="text-blue-300">$F000</code>. It
          isn&rsquo;t built out of the gates above. Its blocks are written to do the same jobs as
          the real chip&rsquo;s, and that skips the part this page hasn&rsquo;t covered yet: how an
          instruction gets decoded into the signals that drive everything else. The CPU is laid out
          like the real chip&rsquo;s block diagram, with the same program counter, ALU, registers
          and internal buses. The wiring inside each block is simpler than the real chip&rsquo;s,
          but on every clock cycle it reads or writes the same address and data as a real 6502,
          including the extra reads the real chip makes along the way. I checked this against{' '}
          <a
            href="https://github.com/SingleStepTests/65x02"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Tom Harte&rsquo;s tests
          </a>
          , 1.5 million single instructions recorded cycle by cycle, and{' '}
          <a
            href="https://github.com/Klaus2m5/6502_65C02_functional_tests"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Klaus Dormann&rsquo;s
          </a>{' '}
          functional and decimal-mode test programs, and it passes both.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The programs in the ROM are written in C and compiled with{' '}
          <a
            href="https://cc65.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            cc65
          </a>
          , a C compiler for the 6502. Press <strong>Run</strong> to start one. You can also edit
          the code and compile your own, and the compiler runs in your browser too. There&rsquo;s no
          operating system on this computer, so when a program calls <code>printf</code> the C
          library hands each character to a few lines of startup code, which store it at{' '}
          <code className="text-blue-300">$F000</code> for the console to show.
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
          The line under the code shows the CPU&rsquo;s registers as it runs, in hex. PC is the
          program counter, a bigger version of the counter from earlier. A is where arithmetic
          results go, X and Y count and index through memory, S points at the stack. The lettered
          boxes are the status flags, and each one lights up while it&rsquo;s set: Z when the last
          result was zero, C when an addition carried, N when a result came out negative. Branch
          instructions check them to decide whether to jump, which is how <code>if</code> statements
          and loops work. Hover over any of them for what it means.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          You can also{' '}
          <a
            href="/circuit?example=6502-computer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            open this computer in the circuit editor
          </a>{' '}
          and step it one clock cycle at a time. Double-click the CPU to see its decode PLA, ALU and
          buses, and watch the values on them change as each instruction runs.
        </p>
      </div>
    </section>
  );
}
