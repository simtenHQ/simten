"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { CORDIC_CIRCUITS } from "../circuits";

export function LookupSection() {
  const circuit = CORDIC_CIRCUITS.angleLookup;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Angle Lookup Table
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each CORDIC iteration rotates by a pre-computed angle: atan(2
          <sup>&minus;i</sup>). These values are baked into{" "}
          <code>Constant</code> nodes and selected by a cascaded{" "}
          <code>Mux</code> tree that uses the iteration index bits as selectors.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The table starts at 32 (representing 45&deg;) and shrinks: 19
          (&asymp;&nbsp;26.6&deg;), 10 (&asymp;&nbsp;14&deg;), 5
          (&asymp;&nbsp;7.1&deg;), 3, 1, 1, 0. Change the{" "}
          <strong>iteration</strong> input from 0 to 7 and watch the selected
          angle change. Three layers of muxes select one of eight values using
          just three bits.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          code={circuit.dsl}
          height={320}
          showControls={false}
          displayCode={circuit.displayCode}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
