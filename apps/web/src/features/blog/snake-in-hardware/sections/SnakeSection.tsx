
import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const SnakeDemo = lazy(() => import("../SnakeDemo").then((m) => ({ default: m.SnakeDemo })));

function SnakeDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading Snake game circuit...</span>
      </div>
    </div>
  );
}

export function SnakeSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full Snake Game
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything from the sections above is one circuit now: framebuffer,
          addressing, the phase pipeline, collision detection, the lot. The full{" "}
          <strong className="text-gray-900 dark:text-white">Snake</strong> circuit is
          about 300 lines of TypeScript, compiled and running in your browser.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The body is a circular buffer of pixel addresses in RAM
          64&ndash;127. The four phases: phase&nbsp;0 reads the tail address,
          phase&nbsp;1 clears the tail pixel, phase&nbsp;2 writes the new head
          address, phase&nbsp;3 draws the new head. Eating food suppresses the
          tail clear, so the snake grows.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In case you want to play again&hellip;
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<SnakeDemoLoader />}>
          <Suspense fallback={<SnakeDemoLoader />}>
            <SnakeDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Fair warning: it has bugs. The snake can turn back the way it came and
          run straight into itself, and you&rsquo;ll find other rough edges if
          you go looking. That&rsquo;s part of the charm of building a game out
          of gates instead of code.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Want to take it apart? Open the whole circuit in the{" "}
          <a
            href="/circuit?example=snake"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            editor
          </a>{" "}
          to trace every wire, change it, and break it in new and interesting
          ways.
        </p>
      </div>
    </section>
  );
}
