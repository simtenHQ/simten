
import { CircuitEmbed } from "@simten/embed";
import { BLOG_CIRCUITS } from "../circuits";

export function CounterSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Putting It Together: A Counter
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Now we combine everything. A <strong className="text-gray-900 dark:text-white">counter</strong>
          {" "}uses flip-flops, NOT gates, XOR gates, and AND gates working
          together. Bit 0 always toggles. Bit 1 toggles when bit 0 is 1. Bit 2
          toggles when bits 0 <em>and</em> 1 are both 1. The AND gates form a
          carry chain &mdash; the same idea as addition.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Tick</strong> repeatedly or hit <strong>Auto</strong>
          {" "}to watch it count. The four LEDs show the binary value: 0000,
          0001, 0010, 0011, ... up to 1111 (15), then it wraps around.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A program counter in a CPU works just like this &mdash; it counts
          through memory addresses, fetching one instruction at a time. The
          only difference is width (16 bits for the 6502) and the ability to
          load a new value (for jumps and branches).
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.counter4bit.circuit}
          showControls
          autoRunSpeed={400}
          title="4-Bit Counter"
          description="Click Tick or Auto to watch it count in binary"
        />
      </div>
    </section>
  );
}
