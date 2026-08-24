/**
 * Explains the circuit shown live in PlayerSection. Deliberately has no canvas
 * of its own — a second, static copy of the same diagram would compete with the
 * running one, and the running one is the point.
 */
export function CircuitSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">What you just heard</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Sixteen nodes. A register and an adder make the phase accumulator: every tick it adds{' '}
          <code>inc</code> to itself and wraps at 2<sup>16</sup>, so <code>inc</code> is the pitch.
          The top twelve bits index the wavetable, and the four discarded bits are the fractional
          part &mdash; a zero-order hold, exactly the shortcut the era took.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The table holds 0&ndash;255, so a subtractor recentres it to two&rsquo;s complement before
          the envelope touches it. Skip that and the envelope would be scaling a DC offset rather
          than a waveform, and every note would click.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The envelope is the cluster on the right: subtract a step each tick, a comparator and mux
          clamp it at zero rather than letting it wrap, and a second mux reloads it to full when{' '}
          <code>trig</code> goes high for one tick. Then one signed multiply scales the sample.
          Everything between the two registers is combinational, which is why one clock tick
          produces exactly one audio sample.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Nothing above is a setting in the page. <code>wave</code> and <code>decay</code> are input
          ports, so changing one drives a signal into the circuit on the next tick &mdash; the same
          way a knob on a real synth does. Had they been <code>Constant</code> nodes they would have
          been hardwired the moment this was synthesised, and the knobs would exist only in the
          browser.
        </p>
      </div>
    </section>
  );
}
