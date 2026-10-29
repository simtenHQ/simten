import { CircuitCard } from '@/components/CircuitCard';
import { BLOG_CIRCUITS } from '../circuits';

export function AdderSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">A 4-bit adder</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          One full adder handles one column of a sum. To add whole numbers, connect the carry-out of
          each full adder to the carry-in of the next, the way you carry a 1 when adding by hand.
          Four in a row add two numbers from 0 to 15.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is a <strong className="text-gray-900 dark:text-white">ripple-carry adder</strong>,
          since the carry works its way up from the lowest bit to the highest. The 6502&rsquo;s
          adder is 8&nbsp;bits wide. Its addresses are 16&nbsp;bits, so it adds them in two halves,
          and when the low half carries into the high half the instruction takes one extra clock
          cycle.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Set the <strong>A</strong> switches (a3&ndash;a0) to 0011 (3) and the <strong>B</strong>{' '}
          switches to 0101 (5). The sum LEDs should read 1000 (8).
        </p>
      </div>

      <div className="mt-8">
        <CircuitCard
          circuit={BLOG_CIRCUITS.adder4bit.circuit}
          title="4-Bit Ripple-Carry Adder"
          description="Set A and B in binary, watch the carry propagate"
        />
      </div>
    </section>
  );
}
