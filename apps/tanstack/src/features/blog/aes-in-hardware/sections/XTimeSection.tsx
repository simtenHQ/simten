"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { AES_CIRCUITS } from "../circuits";

export function XTimeSection() {
  const circuit = AES_CIRCUITS.xTimeDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        XTime: Multiplication in GF(2<sup>8</sup>)
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          MixColumns needs to multiply bytes together, but AES uses arithmetic
          in <strong>GF(2<sup>8</sup>)</strong> — Galois Field of 256 elements.
          There&rsquo;s no normal multiply here. The core operation is{" "}
          <strong>XTime</strong>: multiplication by 2.
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`XTime(x) = (x << 1) XOR (bit7 ? 0x1b : 0)`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Left-shift by one (multiply by 2 in the polynomial ring). If the MSB
          was set before the shift, the result has overflowed 8 bits — XOR with{" "}
          <code>0x1b</code> to reduce it back. That value is the AES irreducible
          polynomial <code>x<sup>8</sup> + x<sup>4</sup> + x<sup>3</sup> + x + 1</code>,
          which keeps the result in 8 bits while preserving the multiplicative
          structure of GF(2<sup>8</sup>). Any other reduction would break the field.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In hardware this is just a one-bit shift, a single bit-test, and one
          conditional XOR. The circuit below does exactly that — follow the path
          from the left-shifter through the Mux (controlled by bit 7) to the
          final XOR.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try these values (decimal):
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm font-mono">
          {[
            ["87", "0x57", "bit7=0", "174", "0xae"],
            ["128", "0x80", "bit7=1", "27", "0x1b"],
            ["149", "0x95", "bit7=1", "53", "0x35"],
          ].map(([dec, hex, note, outDec, outHex]) => (
            <div
              key={dec}
              className="bg-gray-100 dark:bg-gray-900/60 border border-gray-700/50 rounded p-3"
            >
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">input</div>
              <div className="text-gray-900 dark:text-white">{dec} <span className="text-gray-500">({hex})</span></div>
              <div className="text-gray-600 text-xs mt-1">{note} — {note === "bit7=0" ? "no reduction" : "reduction XOR 0x1b"}</div>
              <div className="text-gray-500 text-xs mt-2 mb-1">output</div>
              <div className="text-emerald-400">{outDec} <span className="text-gray-500">({outHex})</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={360}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
