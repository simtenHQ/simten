import { CircuitEmbed } from '@simten/embed';
import { Counter } from '../circuits';

export function CounterSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        A counter: the first useful sequential circuit
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Once you have a register, you can wire its output back to its own input, through some
          logic that transforms the value on the way. The simplest version: pipe the
          register&rsquo;s <code>q</code> through an adder that adds 1, and feed the sum back into{' '}
          <code>data</code>. Hold <code>we</code> high so the new value gets captured on every tick.
          The result is a counter: each clock tick advances the stored value by one.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is the basic shape of every CPU program counter, every frequency divider, every state
          machine&rsquo;s state register: a register, plus combinational logic that decides what its
          next value should be, with the result looping back through itself.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Hit the play button to auto-step, or step one cycle at a time. The count display shows the
          register&rsquo;s current value.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={Counter}
          title="8-bit counter"
          description="Register + Adder loop. Each tick: q → q + 1 → next q."
        />
      </div>
    </section>
  );
}
