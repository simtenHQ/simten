
import { CircuitEmbed } from "@turing-incomplete/embed";
import { BLOG_CIRCUITS } from "../circuits";

export function MemorySection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Memory: Teaching Circuits to Remember
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything so far has been <strong className="text-gray-900 dark:text-white">combinational</strong>
          {" "}&mdash; the outputs depend only on the current inputs. But a
          computer needs to <em>remember</em> things. To store a bit, we need
          feedback: a circuit whose output connects back to its own input.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is where the <strong className="text-gray-900 dark:text-white">clock</strong> enters
          the picture. Sequential circuits use a clock signal to synchronize
          state changes. Click the <strong>Tick</strong> button to advance the
          clock by one cycle.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* SR Latch */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            SR Latch
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The simplest memory cell: two NOR gates cross-coupled. Toggle{" "}
            <strong>S</strong> (Set) to store a 1, toggle <strong>R</strong>
            {" "}(Reset) to clear it. Notice how the output{" "}
            <em>stays</em> after you release the input &mdash; that&rsquo;s
            memory!
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.srLatch.circuit}
            height={260}
            title="SR Latch"
            description="Set stores a 1, Reset clears to 0"
          />
        </div>

        {/* D Flip-Flop */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            D Flip-Flop
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The workhorse of digital memory. The D flip-flop captures whatever
            value is on the <strong>D</strong> input when the clock ticks, and
            holds it until the next tick. Set the switch, then click{" "}
            <strong>Tick</strong> to capture the value.
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.dFlipFlop.circuit}
            height={220}
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
            Four D flip-flops in parallel, sharing a clock. Set some switches,
            click <strong>Tick</strong>, and the register captures all four bits
            at once. This is exactly how CPU registers work &mdash; just wider
            (8, 16, 32, or 64 bits).
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.register4bit.circuit}
            height={350}
            showControls
            title="4-Bit Register"
            description="Stores 4 bits simultaneously on each clock tick"
          />
        </div>
      </div>
    </section>
  );
}
