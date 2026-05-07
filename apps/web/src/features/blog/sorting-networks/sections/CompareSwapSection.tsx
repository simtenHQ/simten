
import { CircuitEmbed } from "@simten/embed";
import { SORTING_CIRCUITS } from "../circuits";

export function CompareSwapSection() {
  const entry = SORTING_CIRCUITS.compareSwapDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Compare-and-Swap Primitive
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Every sorting network is built from a single building block: the{" "}
          <strong>compare-and-swap</strong>. Give it two values and it always
          puts the smaller on <code>lo</code> and the larger on{" "}
          <code>hi</code>. If the inputs are already in order, nothing changes.
          If they are out of order, they are swapped. Either way, the operation
          completes in the same number of gate delays.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          There is no branch instruction deciding which path to take. A{" "}
          <code>Comparator</code> asserts its <code>lt</code> output when{" "}
          <code>a &lt; b</code>, and that single bit drives two{" "}
          <code>Mux</code> nodes &mdash; one to route the minimum, one to route
          the maximum. The circuit evaluates in parallel every cycle regardless
          of the values flowing through it.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing inputs <strong>a</strong> and <strong>b</strong> below.
          No matter what values you enter, <code>lo</code> always shows the
          smaller and <code>hi</code> always shows the larger.
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
