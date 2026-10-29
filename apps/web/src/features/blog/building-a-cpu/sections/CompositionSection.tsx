import { CircuitCard } from '@/components/CircuitCard';
import { GATE_CIRCUITS } from '../circuits';

export function CompositionSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Adding bits</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Wiring a few of those gates together gives you circuits that do arithmetic, starting with
          adding two bits.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* Half Adder */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Half Adder</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Adds two bits. The <strong>sum</strong> is their XOR and the <strong>carry</strong> is
            their AND. Set both to 1: 1 + 1 is 10 in binary, so sum shows 0 and carry shows 1.
          </p>
          <CircuitCard
            circuit={GATE_CIRCUITS.halfAdder.circuit}
            title="Half Adder"
            description="Adds two bits: produces sum and carry"
          />
        </div>

        {/* Full Adder */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Full Adder</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Two half adders and an OR gate, with a third input for the <strong>carry-in</strong>{' '}
            from the column to its right. With that input you can chain them, one per bit, so eight
            of them add two bytes.
          </p>
          <CircuitCard
            circuit={GATE_CIRCUITS.fullAdder.circuit}
            title="Full Adder"
            description="Adds three bits: a, b, and carry-in"
          />
        </div>

        {/* Multiplexer */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Multiplexer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The <strong>sel</strong> switch picks which input, A or B, reaches the output. A CPU
            uses these all over the place to choose where each value comes from.
          </p>
          <CircuitCard
            circuit={GATE_CIRCUITS.mux.circuit}
            title="2:1 Multiplexer"
            description="sel=OFF picks A, sel=ON picks B"
          />
        </div>
      </div>
    </section>
  );
}
