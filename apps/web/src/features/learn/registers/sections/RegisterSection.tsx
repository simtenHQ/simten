import { CircuitEmbed } from '@simten/embed';
import { Register } from '@simten/core/std';

export function RegisterSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Registers: write-enable and width
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A flip-flop captures its input on every clock edge. That&rsquo;s often more than you want
          &mdash; a CPU register, for instance, should hold its value across many cycles and only
          update when an instruction tells it to. The fix is one extra input:{' '}
          <strong>write-enable</strong> (<code>we</code>). When <code>we</code> is high on the clock
          edge, the register captures the new value. When it&rsquo;s low, the register holds
          whatever was there before.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A register is also <strong>parameterized by width</strong>.{' '}
          <code>Register(&#123; width: 1 &#125;)</code> is essentially a D flip-flop with
          write-enable. <code>Register(&#123; width: 8 &#125;)</code> holds eight bits.{' '}
          <code>Register(&#123; width: 32 &#125;)</code> holds a 32-bit word. Same primitive, same
          semantics &mdash; the bit width changes, the structure doesn&rsquo;t.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Type a value into <code>data</code> (or click to scrub), toggle <code>we</code>, then step
          the clock. Notice that the stored value only changes when both <code>we</code> is high{' '}
          <em>and</em> the clock ticks.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={Register({ width: 4 })}
          title="4-bit register"
          description="data + we → q on clock tick. Hold we low and the register ignores data changes."
        />
      </div>
    </section>
  );
}
