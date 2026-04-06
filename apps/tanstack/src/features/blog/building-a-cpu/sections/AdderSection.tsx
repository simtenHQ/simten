"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { BLOG_CIRCUITS } from "../circuits";

export function AdderSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Scaling Up: A 4-Bit Adder
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          We built a full adder that adds three single bits. But a CPU needs to
          add <em>numbers</em>. The trick is{" "}
          <strong className="text-gray-900 dark:text-white">chaining</strong>: connect the carry-out
          of each full adder to the carry-in of the next. Four full adders in a
          row give you a 4-bit adder that can add numbers 0&ndash;15.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is called a{" "}
          <strong className="text-gray-900 dark:text-white">ripple-carry adder</strong> because the
          carry &ldquo;ripples&rdquo; from the least significant bit to the most
          significant. The 6502 uses exactly this pattern, just wider &mdash;
          8&nbsp;bits for its ALU, 16&nbsp;bits for address arithmetic.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try it: set the <strong>A</strong> switches (a3&ndash;a0) to 0011
          (3) and the <strong>B</strong> switches to 0101 (5). You should see
          the sum LEDs show 1000 (8).
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          code={BLOG_CIRCUITS.adder4bit.dsl}
          displayCode={BLOG_CIRCUITS.adder4bit.displayCode}
          height={380}
          title="4-Bit Ripple-Carry Adder"
          description="Set A and B in binary, watch the carry propagate"
        />
      </div>
    </section>
  );
}
