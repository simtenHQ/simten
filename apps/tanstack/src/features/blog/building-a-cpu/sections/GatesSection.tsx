"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { GATE_CIRCUITS } from "../circuits";

export function GatesSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Starting from Nothing: The NAND Gate
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Every computer ever built &mdash; from the Apollo Guidance Computer to
          the M4 chip in your MacBook &mdash; can be constructed from a single
          type of logic gate: <strong className="text-gray-900 dark:text-white">NAND</strong>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A NAND gate outputs 0 only when <em>both</em> its inputs are 1.
          That&rsquo;s it. From this one building block, we can create every
          other logic gate, and from those gates, an entire computer.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Let&rsquo;s start by building the basic gates. Click the switches to
          toggle inputs and watch the output LED respond.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* NOT Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            NOT &mdash; The Inverter
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Wire both NAND inputs together. When the input is 1, both NAND
            inputs are 1, so the output is 0. Inversion!
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.inverter.circuit}
            displayCode={GATE_CIRCUITS.inverter.displayCode}
            height={220}
            title="NOT Gate"
            description="Toggle the switch to see the output invert"
          />
        </div>

        {/* AND Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            AND Gate
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            NAND followed by NOT. The double negation cancels out, giving us
            a gate that outputs 1 only when both inputs are 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.and.circuit}
            displayCode={GATE_CIRCUITS.and.displayCode}
            height={220}
            title="AND Gate"
            description="Output is ON only when both inputs are ON"
          />
        </div>

        {/* OR Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            OR Gate
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            De Morgan&rsquo;s theorem in action: NOT each input, then NAND the
            results. The output is 1 when <em>either</em> input is 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.or.circuit}
            displayCode={GATE_CIRCUITS.or.displayCode}
            height={220}
            title="OR Gate"
            description="Output is ON when either input is ON"
          />
        </div>

        {/* XOR Gate */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            XOR &mdash; Exclusive OR
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The &ldquo;difference detector&rdquo; &mdash; outputs 1 only when
            inputs are <em>different</em>. Built from 4 NAND gates. This one
            is essential for arithmetic.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.xor.circuit}
            displayCode={GATE_CIRCUITS.xor.displayCode}
            height={260}
            title="XOR Gate"
            description="Output is ON when inputs differ"
          />
        </div>
      </div>
    </section>
  );
}
