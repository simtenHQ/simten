"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { SWITCH_CIRCUITS } from "../circuits";

export function ArbiterSection() {
  const circuit = SWITCH_CIRCUITS.portArbiter;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Fair Arbitration
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          When both ports have packets buffered and ready to send, someone has to
          decide who goes first. The{" "}
          <strong className="text-white">arbiter</strong> implements a{" "}
          <strong className="text-white">round-robin</strong> policy: it
          remembers which port was granted last and prefers the other one next
          time. If only one port is ready, it gets the grant immediately.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is a purely combinational circuit &mdash; no clock needed. The{" "}
          <strong>lastPort</strong> input represents the last-granted port (0
          or 1). Toggle <strong>port0_ready</strong> and{" "}
          <strong>port1_ready</strong> to see how the{" "}
          <strong>portDisplay</strong> and <strong>validLed</strong> respond.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Try both ports ready with <strong>lastPort</strong> = 0: port 1 wins.
          Change <strong>lastPort</strong> to 1: port 0 wins. Fair and simple.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={260}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
