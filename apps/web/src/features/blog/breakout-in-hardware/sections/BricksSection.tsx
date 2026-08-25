export function BricksSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Brick Collision</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The 128 bricks fill the top four rows (Y &lt; 4). Each one is a single bit in a
          DualPortRAM: 1 if the brick is alive, 0 if it has been destroyed. That one bit per cell is
          the entire game state for the wall.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Collision reads the RAM at the ball&rsquo;s <em>next</em> position. If that cell is alive
          and in the brick rows, it&rsquo;s a hit: the Y velocity flips and the same cell is written
          to 0, so the brick vanishes. The bounce is applied to the position on the same clock, so
          the ball reflects off the face of the wall instead of sinking into it, and it only eats a
          row deeper once the bricks in front of it are gone.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          One DualPortRAM does double duty. Port A serves the game logic, reading the ball&rsquo;s
          next cell for collision and clearing hit bricks. Port B serves the picture: the raster
          scan reads the brick under the current pixel to decide whether to light it. The alive-bits
          are both the state and the image; there&rsquo;s no separate structure tracking which
          bricks are left.
        </p>
      </div>
    </section>
  );
}
