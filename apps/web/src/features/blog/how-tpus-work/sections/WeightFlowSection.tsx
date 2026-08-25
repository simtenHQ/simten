import { CircuitEmbed } from '@simten/embed';
import { TPU_CIRCUITS } from '../circuits';

export function WeightFlowSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Vertical Partial-Sum Flow
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Data flows horizontally, but partial sums flow{' '}
          <strong className="text-gray-900 dark:text-white">vertically</strong>. Here we stack two
          PEs in a column. The top PE receives{' '}
          <code className="text-blue-300">partialSumIn = 0</code> and computes{' '}
          <code className="text-blue-300">0 + data &times; weight0</code>. That result is
          registered, and it appears at the top PE&rsquo;s{' '}
          <code className="text-blue-300">partialSumOut</code> one cycle later. The bottom PE then
          adds its own <code className="text-blue-300">data &times; weight1</code> to produce the
          full dot product, again registered one cycle later.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This vertical flow is{' '}
          <strong className="text-gray-900 dark:text-white">registered</strong>: partial sums move
          down one PE per clock cycle, just like data moves right one PE per cycle. This symmetry is
          critical for timing in real hardware. A 256-deep combinational chain couldn&rsquo;t close
          timing at TPU clock speeds. Instead, each PE latches its partial sum into a register,
          giving the signal a full cycle to propagate to the next PE.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          To compensate for this vertical delay, the systolic array uses{' '}
          <strong className="text-gray-900 dark:text-white">staggered data injection</strong>:
          row&nbsp;0 receives data starting at cycle&nbsp;1, row&nbsp;1 at cycle&nbsp;2, and so on.
          This keeps partial sums and activations synchronized as they flow through the array. Load
          weights (toggle <code className="text-blue-300">weightValid</code> on, tick, toggle off),
          then tick twice to see the top result, and a third time for the bottom result.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={TPU_CIRCUITS.twoPEColumn.circuit}
          layout={TPU_CIRCUITS.twoPEColumn.layout}
          showControls
          autoRunSpeed={400}
          title="Two-PE Column"
          description="Partial sums flow down through registers, one PE per clock cycle, matching real TPU hardware."
        />
      </div>
    </section>
  );
}
