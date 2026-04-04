"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";

export function NandSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Only Gate You Need
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A NAND gate outputs <strong>0 only when both inputs are 1</strong>.
          Every other combination gives 1. That&rsquo;s it. Toggle the switches
          below &mdash; try all four combinations and build the truth table in
          your head:
        </p>
        <div className="grid grid-cols-4 gap-2 text-sm font-mono text-center max-w-xs">
          {[
            ["A", "B", "NAND"],
            ["0", "0", "1"],
            ["0", "1", "1"],
            ["1", "0", "1"],
            ["1", "1", "0"],
          ].map((row, i) => (
            <>{row.map((cell, j) => (
              <div
                key={`${i}-${j}`}
                className={`px-2 py-1.5 rounded ${
                  i === 0
                    ? "text-gray-500 dark:text-gray-400 font-semibold"
                    : i === 4 && j === 2
                    ? "bg-red-950/30 text-red-400"
                    : j === 2
                    ? "bg-emerald-950/30 text-emerald-400"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {cell}
              </div>
            ))}</>
          ))}
        </div>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The name comes from <strong>Not-AND</strong> &mdash; it&rsquo;s the
          inverse of AND. In 1913, Henry Sheffer proved that NAND alone can
          express every possible Boolean function. This means you can build
          an entire computer from nothing but NAND gates. Let&rsquo;s start.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={`
const NandDemo = component('NandDemo')
  .node('A', Switch)
  .node('B', Switch)
  .node('gate', Nand)
  .node('light', Led)
  .connect(({ in: inp, out, A, B, gate, light }) => [
    A.out.to(gate.a),
    B.out.to(gate.b),
    gate.out.to(light.in),
  ])
  .build()
`}
          height={200}
          showControls={false}
          nodePositions={{
            A: { x: 0, y: 0 },
            B: { x: 0, y: 120 },
            gate: { x: 250, y: 50 },
            light: { x: 470, y: 50 },
          }}
        />
      </div>
    </section>
  );
}
