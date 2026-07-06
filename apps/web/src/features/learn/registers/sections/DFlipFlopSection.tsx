import { CircuitEmbed } from '@simten/embed';
import { DFlipFlop } from '@simten/core/std';

export function DFlipFlopSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The D flip-flop</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A combinational circuit is a pure function: outputs depend only on current inputs, change
          every input and the output changes immediately. There&rsquo;s nowhere for state to live.
          The smallest piece of hardware that <em>does</em> have a place for state is the{' '}
          <strong>D flip-flop</strong> &mdash; one bit of memory.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          It has one input (<code>d</code>), one output (<code>q</code>), and a{' '}
          <strong>clock</strong>. Whatever value is on <code>d</code>
          when the clock ticks is captured and held on <code>q</code>
          until the next tick. Between ticks the input can change all it wants &mdash;{' '}
          <code>q</code> doesn&rsquo;t.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Toggle <code>d</code> below and watch nothing happen. Press the step button to advance the
          clock one cycle. The output catches up.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={DFlipFlop()}
          title="D flip-flop"
          description="Toggle d, then step the clock — q captures d on the tick."
        />
      </div>
    </section>
  );
}
