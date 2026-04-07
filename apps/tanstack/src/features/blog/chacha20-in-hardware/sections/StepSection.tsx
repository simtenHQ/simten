
import { CircuitEmbed } from "@turing-incomplete/embed";
import { CHACHA20_CIRCUITS } from "../circuits";

export function StepSection() {
  const entry = CHACHA20_CIRCUITS.arxStep;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Chaining: ADD &rarr; XOR &rarr; Rotate
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each of the four steps in a quarter-round chains the three operations
          together. Take the first step:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`a += b;    // modular addition
d ^= a;    // XOR new a into d
d <<<= 16; // rotate d left by 16`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The addition creates carry-chain diffusion. The XOR mixes
          that result into <code>d</code>. The rotation spreads the mixed
          bits across the entire word. One step alone is weak &mdash; but
          four steps, repeated across 20 rounds, make the output
          indistinguishable from random.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the circuit below, follow the data flow from left to right:
          the <code>Adder</code> feeds the <code>BusXor</code>, which feeds
          the <code>RotateLeft16</code>. Change any input (decimal) and the
          entire chain recomputes instantly.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={320}
          showControls={false}
          displayCode={entry.displayCode}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
