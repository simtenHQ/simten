import { CircuitEmbed } from '@simten/embed';
import { TPU_CIRCUITS } from '../circuits';

export function PhaseSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Wavefront Control</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A systolic array needs a{' '}
          <strong className="text-gray-900 dark:text-white">cycle counter</strong> to orchestrate
          the computation. In our 2&times;2 array, the entire matrix multiply takes just{' '}
          <strong className="text-gray-900 dark:text-white">4 clock cycles</strong>: one cycle to
          load weights, then three cycles of pipelined data flow (the formula is 2N&minus;1 for an
          N&times;N array).
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The controller is built around a{' '}
          <strong className="text-gray-900 dark:text-white">phase register</strong> and a set of{' '}
          <strong className="text-gray-900 dark:text-white">comparators</strong>. The register holds
          the current cycle number. Each comparator checks whether the cycle matches a specific
          value and drives an LED. When the enable switch is toggled, an incrementer advances the
          cycle on each clock tick.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the full systolic array, cycle&nbsp;0 loads all weights into the PEs.
          Cycles&nbsp;1&ndash;2 inject activation data into the rows. By cycle&nbsp;3, the last
          result emerges from the pipeline, and cycle&nbsp;4 signals done. Toggle the{' '}
          <code className="text-blue-300">enable</code> switch and tick to watch the cycle advance
          and the LEDs light up in sequence.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={TPU_CIRCUITS.wavefrontController.circuit}
          layout={TPU_CIRCUITS.wavefrontController.layout}
          showControls
          autoRunSpeed={400}
          title="Wavefront Controller"
          description="Toggle enable and tick to advance through phases. LEDs show active phase."
        />
      </div>
    </section>
  );
}
