
import { CircuitEmbed } from "@simten/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function CollisionSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Eating Food
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          When the head lands on the food, the snake grows by one segment and
          the food respawns. To catch that, compare head X to food X and head Y
          to food Y. If <em>both</em> match, it&rsquo;s a hit.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Two <strong className="text-gray-900 dark:text-white">Comparators</strong> produce
          equality flags; an{" "}
          <strong className="text-gray-900 dark:text-white">And</strong> gate combines them into a{" "}
          <code className="text-blue-300">collision</code> signal that drives a
          &ldquo;grow&rdquo; flag, 1 on a hit and 0 otherwise.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the full game, grow suppresses the tail for one step: the head
          advances, the tail stays, so the snake gets one longer. Match the
          coordinates below (or don&rsquo;t) and watch the collision LED.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.collisionDetector.circuit}
          layout={SNAKE_CIRCUITS.collisionDetector.layout}
          showControls
          title="Collision Detector"
          description="Change head/food coordinates to match and see the collision LED light up"
        />
      </div>
    </section>
  );
}
