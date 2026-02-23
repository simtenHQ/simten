"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { SWITCH_CIRCUITS } from "../circuits";

export function BufferSection() {
  const circuit = SWITCH_CIRCUITS.packetBuffer;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Buffering Incoming Packets
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Once the parser detects a frame, bytes need to go somewhere. The{" "}
          <strong className="text-white">ingress buffer</strong> stores each
          incoming byte in a <code>DualPortRAM</code>. A{" "}
          <strong className="text-white">write pointer</strong> register tracks
          the next free address and increments after each write.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Port A handles writes (the ingress side), while port B lets us read
          back any stored byte by address &mdash; this is how the forwarder will
          later fetch packet data for routing.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Set <strong>dataIn</strong> to any value, toggle{" "}
          <strong>writeCmd</strong>, and tick. The byte is written at the current
          pointer address, and the pointer advances. Change{" "}
          <strong>readAddr</strong> to read back previously stored bytes.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={280}
          showControls
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
