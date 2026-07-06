export function WhenToEncapsulateSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">When to encapsulate</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Three rules of thumb for when a cluster of gates deserves a name:
        </p>
        <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 leading-relaxed space-y-2">
          <li>
            <strong>You use it more than once.</strong> A 4-bit adder uses four full adders; without
            the abstraction, you&rsquo;d wire the same five-gate pattern four times.
          </li>
          <li>
            <strong>It&rsquo;s conceptually one thing.</strong> A half adder isn&rsquo;t &ldquo;an
            XOR and an AND&rdquo; &mdash; it&rsquo;s an adder. The abstraction matches the level you
            think at.
          </li>
          <li>
            <strong>It would clutter the parent.</strong> If inlining the cluster would make the
            enclosing circuit harder to read, it wants to be its own node.
          </li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The other half of abstraction is <strong>parameterization</strong> &mdash;{' '}
          <code>Adder(&#123; width: 8 &#125;)</code> and <code>Adder(&#123; width: 32 &#125;)</code>{' '}
          are the same abstraction specialized differently. One definition, many uses.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This same hierarchy is what <strong>Verilog</strong> and <strong>SystemVerilog</strong>{' '}
          modules express in real chip design. Designers describe modules with named ports,
          parameters, and instances of other modules; a synthesis tool maps that hierarchy down to
          cells from a foundry library (NAND, NOR, AOI, full adders, flip-flops &mdash; already well
          above gate level). Nobody, anywhere, is drawing NAND gates by hand.
        </p>
      </div>
    </section>
  );
}
