import { CircuitEmbed } from '@simten/embed';
import { HighlightedCode } from '@/components/HighlightedCode';
import { ABSTRACTION_CIRCUITS } from '../circuits';

export function TwoWaysSection() {
  const flat = ABSTRACTION_CIRCUITS.flatHalfAdder;
  const wrapped = ABSTRACTION_CIRCUITS.encapsulatedHalfAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The same circuit, two ways
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A half adder is two gates &mdash; an XOR for the sum, an AND for the carry. The version
          below collapses those two gates into a single labeled <code>HalfAdder</code> node with the
          same external ports. Both produce identical outputs because they <em>are</em> the same
          circuit.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That collapse is abstraction. Nothing is hidden &mdash; the gates are still there, doing
          the same work &mdash; but once a structure has a name, you can stop thinking about its
          parts.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In code, the rule is: declaring <code>inputs</code> and/or <code>outputs</code> on a{' '}
          <code>circuit()</code> is what turns it into a block you can drop into another circuit as
          a node. Without either, you have a self-contained simulation &mdash; runnable on its own
          but not composable.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-mono">
            FlatDemo.ts &mdash; no ports
          </div>
          <HighlightedCode
            className="px-4 py-3 text-[12px] leading-relaxed overflow-x-auto"
            code={`circuit('FlatDemo', {
  nodes: {
    a: Switch, b: Switch,
    xor: Xor, and: And,
    sum: Led, carry: Led,
  },
  connect: ({ nodes }) => [
    nodes.a.out.to(nodes.xor.a, nodes.and.a),
    nodes.b.out.to(nodes.xor.b, nodes.and.b),
    nodes.xor.out.to(nodes.sum.in),
    nodes.and.out.to(nodes.carry.in),
  ],
})`}
          />
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground font-mono">
            HalfAdder.ts &mdash; composable
          </div>
          <HighlightedCode
            className="px-4 py-3 text-[12px] leading-relaxed overflow-x-auto"
            code={`circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes:   { xor: Xor, and: And },
  connect: ({ inputs, outputs, nodes }) => [
    inputs.a.to(nodes.xor.a, nodes.and.a),
    inputs.b.to(nodes.xor.b, nodes.and.b),
    nodes.xor.out.to(outputs.sum),
    nodes.and.out.to(outputs.carry),
  ],
})`}
          />
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <CircuitEmbed
          circuit={flat.circuit}
          showControls={false}
          title={flat.name}
          description={flat.description}
        />
        <CircuitEmbed
          circuit={wrapped.circuit}
          showControls={false}
          title={wrapped.name}
          description={wrapped.description}
        />
      </div>
    </section>
  );
}
