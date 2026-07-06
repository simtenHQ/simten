import { CircuitEmbed } from '@simten/embed';
import { ADDER_CIRCUITS } from '../circuits';

export function RippleCarrySection() {
  const entry = ADDER_CIRCUITS.rippleCarry;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Chaining them: ripple-carry
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          To add two 8-bit numbers, chain eight full adders together. The carry-out of bit 0 becomes
          the carry-in of bit 1; the carry-out of bit 1 becomes the carry-in of bit 2; and so on.
          This is called a <strong>ripple-carry adder</strong> because the carry signal ripples from
          the low bit to the high bit, one stage at a time.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change the inputs below and watch the result. It works correctly for every pair of values
          &mdash; addition is addition. But there's a subtle cost to this structure that doesn't
          show up in any single-cycle simulation.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={false}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
