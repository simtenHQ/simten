"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { TPU_CIRCUITS } from "../circuits";

export function PhaseSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Wavefront Control
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          A 2&times;2 matrix multiplication C = A &times; B requires multiple
          steps: reset the accumulators, load the first column of weights,
          stream the first set of activations, load the second column of
          weights, stream the second set of activations, and finally signal
          completion. These steps are organized into{" "}
          <strong className="text-white">phases</strong> driven by a wavefront
          controller.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The controller is built around a{" "}
          <strong className="text-white">phase register</strong> and a set of{" "}
          <strong className="text-white">comparators</strong>. The register
          holds the current phase number. Each comparator checks whether the
          phase matches a specific value and drives an LED. When the enable
          switch is toggled, an incrementer advances the phase on each clock
          tick.
        </p>
        <p className="text-gray-300 leading-relaxed">
          In the full systolic array, each phase (reset, k=0, k=1, done)
          controls which weights are loaded, which data rows are injected, and
          when the done signal fires. Toggle the{" "}
          <code className="text-blue-300">enable</code> switch and tick to
          watch the phase advance and the LEDs cycle through the four states.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.wavefrontController.dsl}
          displayDsl={TPU_CIRCUITS.wavefrontController.displayDsl}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Wavefront Controller"
          description="Toggle enable and tick to advance through phases. LEDs show active phase."
        />
      </div>
    </section>
  );
}
