"use client";

import { InlineChallenge } from "../../components/InlineChallenge";

interface NotChallengeSectionProps {
  onPass: () => void;
}

export function NotChallengeSection({ onPass }: NotChallengeSectionProps) {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Challenge 1: Build NOT
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          What happens if you feed the <strong>same signal</strong> into both
          inputs of a NAND gate?
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`NAND(0, 0) = 1
NAND(1, 1) = 0`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Input 0, get 1. Input 1, get 0. That&rsquo;s an <strong>inverter</strong> &mdash;
          a NOT gate. One NAND gate, both inputs tied together. Your first
          circuit built from scratch.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Edit the code below: connect <code>A.out</code> to <strong>both</strong>{" "}
          <code>gate.a</code> and <code>gate.b</code>, then connect
          {" "}<code>gate.out</code> to <code>light.in</code>. Click <strong>Check</strong> to
          verify.
        </p>
      </div>

      <InlineChallenge
        title="NOT from NAND"
        objective="Connect A to both NAND inputs. When A is ON, the LED should be OFF."
        hints={[
          "You need three connect lines total.",
          "connect A.out -> gate.a\nconnect A.out -> gate.b\nconnect gate.out -> light.in",
        ]}
        scaffold={`
const NotFromNand = component('NotFromNand', {
  nodes: { A: Switch, gate: Nand, light: Led },
})
`}
        checks={[
          { description: "NOT(0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0]] },
          { description: "NOT(1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1]] },
        ]}
        height={200}
        nodePositions={{
          A: { x: 0, y: 50 },
          gate: { x: 250, y: 50 },
          light: { x: 470, y: 50 },
        }}
        onPass={onPass}
      />
    </section>
  );
}
