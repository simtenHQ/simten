
import { CircuitEmbed } from "@simten/embed";
import { TPU_CIRCUITS } from "../circuits";

export function WeightSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Weight Register
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In a TPU, weights are loaded <em>before</em> data starts flowing. Each
          processing element has a{" "}
          <strong className="text-gray-900 dark:text-white">weight register</strong> that captures a
          value only when a{" "}
          <strong className="text-gray-900 dark:text-white">valid bit</strong> is asserted. Once
          latched, the weight stays fixed for the entire computation. This is the{" "}
          <strong className="text-gray-900 dark:text-white">weight-stationary</strong> approach
          &mdash; the weight is programmed once, then thousands of activation
          values stream past it, each getting multiplied by the same weight.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit below shows the weight register and a multiplier. Toggle{" "}
          <code className="text-blue-300">weightValid</code> on and click{" "}
          <strong>Tick</strong> to latch the weight. The stored weight display
          captures the value. Now turn valid off and tick again &mdash; the
          stored weight holds steady. Change{" "}
          <code className="text-blue-300">dataIn</code> and watch the product
          update instantly: the stored weight multiplies whatever data arrives.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the real TPUv1, a unified buffer loads weights into all processing
          elements simultaneously. The valid bit is the gating mechanism that
          tells each PE exactly when to capture its weight.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={TPU_CIRCUITS.weightRegister.circuit}
          nodePositions={TPU_CIRCUITS.weightRegister.nodePositions}
          height={350}
          showControls
          autoRunSpeed={400}
          title="Weight Register"
          description="Toggle valid to store the weight. It stays fixed while data streams through."
        />
      </div>
    </section>
  );
}
