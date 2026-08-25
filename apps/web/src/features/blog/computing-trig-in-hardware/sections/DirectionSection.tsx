import { CircuitEmbed } from '@simten/embed';
import { CORDIC_CIRCUITS } from '../circuits';

export function DirectionSection() {
  const entry = CORDIC_CIRCUITS.signDetection;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Which Way to Rotate?
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          CORDIC tracks the remaining rotation angle in a register called <strong>z</strong>. Each
          iteration, it checks the sign of z: if z is positive (we still need to rotate
          counterclockwise), it rotates one way; if z is negative (we overshot), it rotates back.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A <code>SignedComparator</code> checks whether z &ge; 0 and drives a <code>Mux</code> that
          selects between addition and subtraction. Try setting the angle input to different values:
          values above 127 are treated as negative in signed 8-bit arithmetic.
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
