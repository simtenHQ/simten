"use client";

import { ComponentEmbed } from "@turing-incomplete/embed";
import { SWITCH_CIRCUITS } from "../circuits";

export function FrameSection() {
  const circuit = SWITCH_CIRCUITS.frameDetector;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Detecting Ethernet Frames
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Raw bytes arrive on a wire, but not every byte is a packet. An
          Ethernet frame starts with a <strong className="text-gray-900 dark:text-white">preamble</strong>{" "}
          &mdash; a sequence of 0x55 bytes &mdash; followed by a{" "}
          <strong className="text-gray-900 dark:text-white">Start-of-Frame Delimiter</strong> (SFD,
          0xD5). The switch must detect this pattern to know when real data
          begins.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This circuit implements a small{" "}
          <strong className="text-gray-900 dark:text-white">finite state machine</strong> with three
          states: <em>Idle</em> (0), <em>Waiting for SFD</em> (1), and{" "}
          <em>In Frame</em> (2). The state is stored in a register and updated
          each clock tick based on what byte arrives.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Set <strong>byteIn</strong> to 85 (0x55), toggle the{" "}
          <strong>valid</strong> switch, and tick &mdash; the state moves to 1
          (waiting). Now set <strong>byteIn</strong> to 213 (0xD5) and tick
          again &mdash; the state jumps to 2 and the{" "}
          <strong>frameLed</strong> lights up: we&rsquo;re in a frame.
        </p>
      </div>

      <div className="mt-8">
        <ComponentEmbed
          code={circuit.dsl}
          height={300}
          showControls
          displayCode={circuit.displayCode}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
