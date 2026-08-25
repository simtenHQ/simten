import { CircuitEmbed } from '@simten/embed';
import { CORDIC_CIRCUITS } from '../circuits';

export function IterationSection() {
  const entry = CORDIC_CIRCUITS.iterationControl;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Counting Iterations</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          CORDIC converges quickly, and each iteration adds about one bit of precision. For our
          8-bit values, 8 iterations are enough. A <code>Register</code> counts from 0 to 7, an{' '}
          <code>Incrementer</code> bumps it each tick, and a <code>Comparator</code> disables the
          write enable when the count reaches 8.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Tick</strong> to step the counter. The <strong>Done</strong> LED lights when
          all 8 iterations are complete.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={true}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
