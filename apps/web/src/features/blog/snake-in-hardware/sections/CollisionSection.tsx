
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
          When the snake&rsquo;s head lands on the food, two things happen: the
          snake grows by one segment, and the food respawns at a new location.
          Detection is straightforward &mdash; compare the head&rsquo;s X with
          the food&rsquo;s X, and the head&rsquo;s Y with the food&rsquo;s Y.
          If <em>both</em> match, it&rsquo;s a collision.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Two <strong className="text-gray-900 dark:text-white">Comparator</strong> nodes produce
          equality flags, and an{" "}
          <strong className="text-gray-900 dark:text-white">And</strong> gate combines them into a
          single <code className="text-blue-300">collision</code> signal. This
          feeds into a <strong className="text-gray-900 dark:text-white">Mux</strong> that outputs
          a &ldquo;grow&rdquo; signal: 1 if colliding, 0 otherwise.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the full game, the grow signal suppresses tail movement for one
          step &mdash; the head advances but the tail stays put, making the
          snake one segment longer. Try changing the coordinates below to match
          (or mismatch) and watch the collision LED and grow display react.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.collisionDetector.circuit}
          nodePositions={SNAKE_CIRCUITS.collisionDetector.nodePositions}
          height={350}
          showControls
          title="Collision Detector"
          description="Change head/food coordinates to match and see the collision LED light up"
        />
      </div>
    </section>
  );
}
