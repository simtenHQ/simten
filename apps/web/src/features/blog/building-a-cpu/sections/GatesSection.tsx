import { CircuitEmbed } from '@simten/react/embed';
import { GATE_CIRCUITS } from '../circuits';

export function GatesSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The NAND gate</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Any digital logic can be built from one kind of gate, the{' '}
          <strong className="text-gray-900 dark:text-white">NAND</strong>. Real chips aren&rsquo;t
          designed that way, but it&rsquo;s the simplest place to start.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A NAND gate outputs 0 when <em>both</em> its inputs are 1, and 1 the rest of the time.
          Every other gate can be made out of NANDs, and everything further down this page is made
          out of those gates.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Here are the basic gates, each built from NANDs. Click a switch to flip an input.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* NOT Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">NOT</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Tie both NAND inputs together. A 1 going in means both inputs are 1, so a 0 comes out,
            and a 0 going in gives a 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.inverter.circuit}
            title="NOT Gate"
            description="Toggle the switch to see the output invert"
          />
        </div>

        {/* AND Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AND Gate</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            A NAND followed by a NOT. Inverting the output again leaves a gate that gives 1 only
            when both inputs are 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.and.circuit}
            title="AND Gate"
            description="Output is ON only when both inputs are ON"
          />
        </div>

        {/* OR Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">OR Gate</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Invert each input, then NAND them together (De Morgan&rsquo;s law). The output is 1 when{' '}
            <em>either</em> input is 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.or.circuit}
            title="OR Gate"
            description="Output is ON when either input is ON"
          />
        </div>

        {/* XOR Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">XOR</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Outputs 1 when the inputs are <em>different</em>. It takes four NANDs, and it does most
            of the work in the adders below.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.xor.circuit}
            title="XOR Gate"
            description="Output is ON when inputs differ"
          />
        </div>
      </div>
    </section>
  );
}
