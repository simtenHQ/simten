import { CircuitCard } from '@/components/CircuitCard';
import { BLOG_CIRCUITS } from '../circuits';

export function CounterSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">A counter</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A <strong className="text-gray-900 dark:text-white">counter</strong> is a register that
          adds one to itself on every tick. Bit 0 flips every time, bit 1 flips when bit 0 is 1, and
          bit 2 flips when bits 0 <em>and</em> 1 are both 1. The AND gates that work this out are a
          carry chain, the same as in the adders.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Tick</strong> a few times, or <strong>Auto</strong> to let it run. The LEDs
          count up in binary from 0000 to 1111 (15), then wrap back to 0000.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A CPU&rsquo;s program counter is a counter like this one. It steps through memory one
          address at a time while the CPU fetches instructions. The 6502&rsquo;s is 16&nbsp;bits
          wide, and it can also be loaded with a new address, which is how jumps and branches work.
        </p>
      </div>

      <div className="mt-8">
        <CircuitCard
          circuit={BLOG_CIRCUITS.counter4bit.circuit}
          showControls
          title="4-Bit Counter"
          description="Click Tick or Auto to watch it count in binary"
        />
      </div>
    </section>
  );
}
