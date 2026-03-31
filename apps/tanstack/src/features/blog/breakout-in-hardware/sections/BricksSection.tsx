"use client";

export function BricksSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Brick Collision
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The 16 bricks live in the first two rows of the framebuffer RAM
          (addresses 0&ndash;15). A brick is &ldquo;alive&rdquo; if its RAM
          cell contains 1, and &ldquo;destroyed&rdquo; if 0.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Collision detection reads the RAM at the ball&rsquo;s next position
          during phase 0 of the pipeline. If the value is non-zero and the
          next Y position is in the brick rows (Y &lt; 2), it&rsquo;s a brick
          hit. The Y velocity flips, and during phase 4, the brick&rsquo;s RAM
          cell is written to 0 &mdash; the brick disappears from the screen.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is elegant because the framebuffer <em>is</em> the collision
          map. There&rsquo;s no separate data structure tracking which bricks
          are alive &mdash; the same RAM that the screen reads for display is
          the RAM that the ball reads for collision. One DualPortRAM serves
          both purposes: port B for the screen, port A for game logic.
        </p>
      </div>
    </section>
  );
}
