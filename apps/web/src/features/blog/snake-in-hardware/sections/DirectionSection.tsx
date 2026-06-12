
import { CircuitEmbed } from "@simten/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function DirectionSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Decoding Player Input
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Arrow keys produce scan codes: Up&nbsp;72, Down&nbsp;80, Left&nbsp;75,
          Right&nbsp;77. The circuit turns these into movement deltas{" "}
          <strong className="text-gray-900 dark:text-white">deltaX</strong> and{" "}
          <strong className="text-gray-900 dark:text-white">deltaY</strong>, each
          &minus;1,&nbsp;0, or&nbsp;+1.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Four <strong className="text-gray-900 dark:text-white">Comparators</strong> check the
          code against each direction. Their outputs feed a{" "}
          <strong className="text-gray-900 dark:text-white">Mux tree</strong> that picks the
          delta: Left sets deltaX to 255 (&minus;1 in unsigned 8-bit), Right
          sets it to 1, otherwise 0. deltaY works the same for Up and Down.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Set the key code below to 72, 75, 77, or 80 and watch the two delta
          displays flip between &minus;1, 0, and&nbsp;+1.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.directionDecoder.circuit}
          layout={SNAKE_CIRCUITS.directionDecoder.layout}
          showControls
          title="Direction Decoder"
          description="Key code to deltaX/deltaY. Try 72 (Up), 75 (Left), 77 (Right), 80 (Down)"
        />
      </div>
    </section>
  );
}
