import { CircuitEmbed } from '@simten/embed';
import { ADDER_CIRCUITS } from '../circuits';

export function DepthSection() {
  const entry = ADDER_CIRCUITS.depth;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Why ripple-carry is slow
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose, this is the load-bearing section. Make the depth
            argument concrete. Show that the high-bit's sum can't settle until
            every prior carry has propagated. Walk through what determines
            clock speed (longest combinational path) and why an N-bit
            ripple-carry adder has depth proportional to N. */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Every gate takes some real, physical time to switch. The clock speed of a chip is bounded
          by the <strong>longest combinational path</strong> between any two registers, whatever
          signal has to travel farthest sets the upper limit on how fast the clock can tick.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In a ripple-carry adder, the high-bit's sum can't settle until the carry has propagated
          all the way from bit 0 through every intermediate stage. An 8-bit adder needs the carry to
          traverse eight full-adders before the answer is valid. A 64-bit adder needs 64. Depth
          grows linearly with width, a problem that gets worse exactly as your inputs get wider.
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
