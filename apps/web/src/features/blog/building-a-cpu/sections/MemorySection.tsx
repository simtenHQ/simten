import { CircuitEmbed } from '@simten/embed';
import { BLOG_CIRCUITS } from '../circuits';

export function MemorySection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Remembering a bit</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything so far has been{' '}
          <strong className="text-gray-900 dark:text-white">combinational</strong>, meaning the
          outputs depend only on what the inputs are right now. A computer also has to{' '}
          <em>remember</em> things, and for that a circuit needs feedback, with its output wired
          back into its own input.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Circuits that remember usually change only when a{' '}
          <strong className="text-gray-900 dark:text-white">clock</strong> ticks, so everything
          updates in step. The <strong>Tick</strong> button below advances the clock by one cycle.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* SR Latch */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">SR Latch</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Two NOR gates, each feeding the other. Turn <strong>S</strong> (set) on and off again
            and the output <em>stays</em> at 1. Turn <strong>R</strong> (reset) on and off and it
            goes back to 0.
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.srLatch.circuit}
            title="SR Latch"
            description="Set stores a 1, Reset clears to 0"
          />
        </div>

        {/* D Flip-Flop */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">D Flip-Flop</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Takes whatever is on the <strong>D</strong> input when the clock ticks and holds it
            until the next tick, whatever D does in between. Set the switch, then click{' '}
            <strong>Tick</strong>.
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.dFlipFlop.circuit}
            showControls
            title="D Flip-Flop"
            description="Captures input on each clock tick"
          />
        </div>

        {/* 4-Bit Register */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            4-Bit Register
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Four D flip-flops in parallel, sharing a clock. Set some switches, click{' '}
            <strong>Tick</strong>, and all four bits are stored at once. A CPU&rsquo;s registers are
            the same thing, only wider: the 6502&rsquo;s are 8&nbsp;bits.
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.register4bit.circuit}
            showControls
            title="4-Bit Register"
            description="Stores 4 bits simultaneously on each clock tick"
          />
        </div>
      </div>
    </section>
  );
}
