import { CircuitEmbed } from '@simten/embed';
import { CORDIC_CIRCUITS } from '../circuits';

export function ShiftSection() {
  const entry = CORDIC_CIRCUITS.rightShiftDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Division Without a Divider
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The key insight behind CORDIC is that you never need to multiply or divide. Shifting a
          binary number right by <em>n</em> positions is the same as dividing by 2<sup>n</sup>.
          Shift right by 1 and you divide by 2. Shift by 3 and you divide by 8. Hardware can do this
          in a single gate delay, because it just rewires the bits.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing the <strong>value</strong> and <strong>shift</strong> inputs below. The{' '}
          <code>RightShifter</code> component divides instantly, with no clock cycles and no
          iteration.
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
