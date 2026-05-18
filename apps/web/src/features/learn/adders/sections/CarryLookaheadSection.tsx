import { CircuitEmbed } from "@simten/embed";
import { ADDER_CIRCUITS } from "../circuits";

export function CarryLookaheadSection() {
  const entry = ADDER_CIRCUITS.carryLookahead;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Carry-lookahead: log-depth addition
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose — explain generate (g = a AND b) and propagate
            (p = a XOR b), then how every carry can be derived in parallel
            from g and p without waiting for prior stages. The key insight is
            that the carry-out of stage i depends only on g_i, p_i, and
            carry-in to stage 0, which can be unrolled into a flat expression
            evaluated in parallel. Depth becomes O(log n) instead of O(n). */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The fix is to stop waiting. For each bit position, compute two
          signals in parallel: <strong>generate</strong> (
          <code>g_i = a_i AND b_i</code>, this stage definitely produces a
          carry) and <strong>propagate</strong> (
          <code>p_i = a_i XOR b_i</code>, this stage will pass through whatever
          carry it receives). With those, every carry can be computed in terms
          of every prior <code>g</code> and <code>p</code> at once &mdash; no
          ripple required.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The cost is more gates per stage, but the depth collapses from O(n)
          to O(log n). For a 32-bit adder, that's depth 5 instead of depth 32
          &mdash; the entire reason real CPUs can add 64-bit numbers in a
          single clock cycle.
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
