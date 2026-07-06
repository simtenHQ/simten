import { CircuitEmbed } from '@simten/embed';
import { CRC32_CIRCUITS } from '../circuits';

export function LFSRSection() {
  const entry = CRC32_CIRCUITS.lfsr4;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Shift Register That Never Repeats (Almost)
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A <strong>linear feedback shift register</strong> (LFSR) is a chain of flip-flops where
          the input to the first stage is the XOR of certain output stages. On each clock tick, all
          the bits shift one position, and a new bit is computed at the input from the XOR of the
          &ldquo;tap&rdquo; positions.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          With the right choice of tap positions &mdash; determined by an irreducible polynomial
          over GF(2) &mdash; an n-bit LFSR cycles through every possible non-zero state exactly once
          before repeating. A 4-bit LFSR with taps at positions 0 and 3 visits all 2<sup>4</sup>
          &nbsp;&minus;&nbsp;1 &nbsp;=&nbsp;15 states. A 32-bit LFSR visits over 4 billion.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Step</strong> below to advance the clock. Watch the four LEDs cycle through
          all 15 non-zero patterns. The circuit never visits the same pattern twice until it wraps
          around after 15 steps.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={true}
          title={entry.name}
          description={entry.description}
        />
      </div>

      <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          From LFSR to CRC
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          CRC-32 is a 32-bit LFSR where the &ldquo;input&rdquo; is XOR&rsquo;d with the incoming
          data before being fed back. Instead of generating a pseudorandom sequence, you&rsquo;re
          computing a checksum: the final register state after clocking in all the data bytes is the
          CRC. The Ethernet polynomial 0xEDB88320 (the reflected form of 0x04C11DB7) specifies
          exactly which of the 32 flip-flop outputs get XOR&rsquo;d back &mdash; those are the tap
          positions.
        </p>
      </div>
    </section>
  );
}
