"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function PixelsSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Pixels &amp; Memory
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Every game needs a screen, and every screen needs memory. We use a{" "}
          <strong className="text-white">DualPortRAM</strong> as our
          framebuffer: port A is where game logic reads and writes pixel data,
          while port B is dedicated to the{" "}
          <strong className="text-white">Screen</strong> node, which
          continuously scans through addresses to display an 8&times;8 grid.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The init pattern below draws a border around the screen &mdash; a
          rectangle of lit pixels. Each RAM address maps to one pixel:
          address&nbsp;0 is the top-left, address&nbsp;7 is the top-right,
          address&nbsp;63 is the bottom-right. A value of&nbsp;1 means the
          pixel is on.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle the <strong>write-enable</strong> switch, set an address and
          data value using the Input nodes, then click{" "}
          <strong>Tick</strong> to write a pixel. The HexDisplay shows what was
          read back from that address. This is the same read/write cycle that
          the Snake game will use on every frame.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.simpleFramebuffer.dsl}
          displayDsl={SNAKE_CIRCUITS.simpleFramebuffer.displayDsl}
          height={350}
          showControls
          title="Simple Framebuffer"
          description="DualPortRAM + Screen: toggle write-enable, set address and data, then tick to write a pixel"
        />
      </div>
    </section>
  );
}
