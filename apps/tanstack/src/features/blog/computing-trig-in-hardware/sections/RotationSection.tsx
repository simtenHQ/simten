
import { CircuitEmbed } from "@turing-incomplete/embed";
import { CORDIC_CIRCUITS } from "../circuits";

export function RotationSection() {
  const entry = CORDIC_CIRCUITS.rotationStep;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Rotation Formula
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          To rotate a vector (x, y) by a small angle, CORDIC uses:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-300 p-4 rounded-lg text-sm font-mono">
{`x_next = x - (y >> iteration)
y_next = y + (x >> iteration)`}
        </pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That&rsquo;s it &mdash; a shift and an add for each coordinate.
          Subtraction is done in two&rsquo;s complement: invert all bits with
          a <code>BusNot</code>, then add 1 via the carry input of a{" "}
          <code>SignedAdder</code>. The circuit below computes both{" "}
          <strong>x &minus; (y &gt;&gt; shift)</strong> and{" "}
          <strong>x + (y &gt;&gt; shift)</strong> simultaneously.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={280}
          showControls={false}
          displayCode={entry.displayCode}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
