import { CircuitEmbed } from "@simten/embed";
import { ADDER_CIRCUITS } from "../circuits";

export function CarryLookaheadSection() {
  const entry = ADDER_CIRCUITS.carryLookahead;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Carry-lookahead: faster addition through parallelism
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose — explain generate (g = a AND b) and propagate
            (p = a XOR b), then how every carry can be derived in parallel
            from g and p without waiting for prior stages. */}
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
          &ldquo;Carry-lookahead&rdquo; is really a <em>family</em> of
          designs that share this idea, at different points on a
          depth/area tradeoff curve. <strong>Single-level CLA</strong>{" "}
          groups bits into chunks of k (typically 4) and gets depth
          proportional to <code>n/k</code> &mdash; faster than ripple, but
          still linear. <strong>Multi-level CLA</strong> applies the
          lookahead idea recursively across groups. And{" "}
          <strong>parallel-prefix</strong> networks &mdash; Kogge-Stone,
          Brent-Kung, Han-Carlson &mdash; arrange the g/p combinations as
          a tree, achieving true O(log n) depth.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          For a 32-bit adder, a parallel-prefix structure means depth ~5
          instead of depth 32. That&rsquo;s the actual reason a real CPU
          can add two 64-bit numbers in a single clock cycle &mdash; every
          modern ALU you have ever used is some variant of this family.
          The naive ripple-carry from earlier in this page is correct, but
          it&rsquo;s not what&rsquo;s sitting inside your laptop.
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
