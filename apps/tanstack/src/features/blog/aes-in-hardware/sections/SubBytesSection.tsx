"use client";

import { ComponentEmbed } from "@turing-incomplete/embed";
import { AES_CIRCUITS } from "../circuits";

export function SubBytesSection() {
  const circuit = AES_CIRCUITS.subByteDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        SubBytes: The Lookup Table
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The first step of every AES round is <strong>SubBytes</strong>: each
          of the 16 bytes in the state matrix is independently replaced using a
          fixed 256-entry lookup table called the S-box. Input byte 0x53 always
          maps to 0xed. Input 0x00 always maps to 0x63. The mapping is
          non-linear — that&rsquo;s the entire point.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In hardware, this is a ROM. You present an 8-bit address, and one
          clock edge later you have your 8-bit substitution. That&rsquo;s it.
          The non-linearity that makes AES cryptographically strong comes
          entirely from this table lookup — there&rsquo;s no ALU operation that
          could replace it cheaply.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try a few inputs below. The ROM is pre-loaded with the full FIPS 197
          S-box. Change the decimal value (0&ndash;255) and watch the output
          update:
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm font-mono">
          {[
            ["0x00 = 0", "→ 0x63 = 99"],
            ["0x53 = 83", "→ 0xed = 237"],
            ["0xff = 255", "→ 0x16 = 22"],
          ].map(([input, output]) => (
            <div
              key={input}
              className="bg-gray-100 dark:bg-gray-900/60 border border-gray-700/50 rounded p-3"
            >
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">input</div>
              <div className="text-gray-900 dark:text-white">{input}</div>
              <div className="text-gray-500 text-xs mt-2 mb-1">S-box output</div>
              <div className="text-emerald-400">{output}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <ComponentEmbed
          code={circuit.dsl}
          height={180}
          showControls={false}
          displayCode={circuit.displayCode}
          title={circuit.name}
          description={circuit.description}
        />
      </div>

      <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Why not compute it?
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          The S-box is derived from multiplicative inverses in GF(2<sup>8</sup>)
          followed by an affine transformation. You could compute this on the fly
          with a GF inverter circuit — but it would take dozens of gates and add
          latency to every single round. A ROM trades area for speed, which is
          exactly the right trade-off in a pipelined AES core. A 256&times;8-bit
          ROM is tiny in silicon terms: just 2048 bits of storage.
        </p>
      </div>
    </section>
  );
}
