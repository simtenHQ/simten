"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { BLOG_CIRCUITS } from "../circuits";

export function RAMSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        RAM: Read/Write Memory
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Registers store a few values. A CPU needs <em>thousands</em> of
          addressable bytes. That&rsquo;s{" "}
          <strong className="text-gray-900 dark:text-white">RAM</strong> &mdash; an array of
          memory cells, each with an address. You put an address on the bus and
          the data at that address appears on the output.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The key insight:{" "}
          <strong className="text-gray-900 dark:text-white">reads are instant</strong>{" "}
          (combinational) but{" "}
          <strong className="text-gray-900 dark:text-white">writes need a clock tick</strong>.
          Change the <strong>addr</strong> input and{" "}
          <strong>data_out</strong> updates immediately. To write: set{" "}
          <strong>addr</strong>, set <strong>data_in</strong>, turn{" "}
          <strong>we</strong> (write-enable) ON, then <strong>Tick</strong>.
          Turn <strong>we</strong> OFF and change the address to read it back.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try it: write the value 42 to address 1, then write 7 to address 2.
          Switch between addresses to see both values are remembered. The 6502
          has 2&nbsp;KB of RAM wired to its address bus &mdash; same idea,
          just 2,048 locations instead of 256.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={BLOG_CIRCUITS.ram.dsl}
          displayDsl={BLOG_CIRCUITS.ram.displayDsl}
          height={380}
          showControls
          title="256×8 RAM"
          description="Reads are instant. Writes happen on Tick with we=ON."
        />
      </div>
    </section>
  );
}
