
export function BallSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Ball Physics &amp; Clock Divider
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The ball has four registers: X position, Y position, X velocity (1 or
          255 for right/left), and Y velocity (1 or 255 for down/up). Each clock,
          the next position is computed by adding velocity to position.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          But the ball would be impossibly fast if it moved every clock. A{" "}
          <strong className="text-gray-900 dark:text-white">clock divider</strong> &mdash; a counter
          that counts 0, 1, 2, 3, then resets &mdash; generates an enable signal
          that fires once every 4 clocks. The ball&rsquo;s position registers
          only update when this enable signal is high. The paddle runs off its
          own divider at twice the rate, giving the player a speed advantage.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Clock dividers are fundamental hardware. Every digital system uses them:
          your CPU&rsquo;s peripheral bus runs slower than the core, USB runs at
          12MHz from a 48MHz source, VGA timing derives from a pixel clock. Here,
          it&rsquo;s just a counter and a comparator &mdash; when the counter
          equals the max value, the enable goes high and the counter resets.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Wall bouncing is handled <em>before</em> computing the next position.
          If the ball is at X=0 moving left, the velocity flips to +1 first,
          then the new position is computed. This prevents the ball from
          wrapping around to the other side of the screen.
        </p>
      </div>
    </section>
  );
}
