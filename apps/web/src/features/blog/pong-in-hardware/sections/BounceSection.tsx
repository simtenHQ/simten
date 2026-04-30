
import { CircuitEmbed } from "@simten/embed";
import { PONG_CIRCUITS } from "../circuits";

export function BounceSection() {
  const entry = PONG_CIRCUITS.bounceDetection;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Bounce Detection
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          When the ball reaches the top or bottom edge of the screen, it needs
          to reverse direction. Two <code>Comparator</code> nodes check if the
          ball&rsquo;s Y coordinate equals 0 (top wall) or 15 (bottom wall). An{" "}
          <code>Or</code> gate combines the results, and a <code>Mux</code>{" "}
          flips the velocity: moving down (+1) when bouncing off the top,
          moving up (&minus;1) when bouncing off the bottom.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change <strong>ballY</strong> to 0 or 15 and watch the bounce LED
          light up.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={260}
          showControls={false}
          nodePositions={entry.nodePositions}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
