"use client";

import { InlineChallenge } from "../../components/InlineChallenge";

interface AndChallengeSectionProps {
  onPass: () => void;
}

export function AndChallengeSection({ onPass }: AndChallengeSectionProps) {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Challenge 2: Build AND
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          NAND is <em>Not-AND</em>. So if you negate a NAND&hellip; you get AND.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          You just built NOT. You know NAND. Chain them:
          first NAND the inputs together, then invert the result with your
          NOT trick (both inputs tied). Two NAND gates total.
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`AND(A, B) = NOT(NAND(A, B))
         = NAND(NAND(A,B), NAND(A,B))`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Wire it up. The LED should light <strong>only</strong> when both
          switches are ON.
        </p>
      </div>

      <InlineChallenge
        title="AND from NAND"
        objective="Two NAND gates. nand1 computes NAND(A,B). nand2 inverts it (both inputs = nand1.out)."
        hints={[
          "Connect A.out and B.out to nand1's inputs.",
          "Connect nand1.out to BOTH inputs of nand2 (the NOT trick).",
          "Connect nand2.out to light.in.",
        ]}
        scaffold={`
const AndFromNand = component('AndFromNand')
  .node('A', Switch)
  .node('B', Switch)
  .node('nand1', Nand)
  .node('nand2', Nand)
  .node('light', Led)
  .build()
`}
        checks={[
          { description: "AND(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
          { description: "AND(0,1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 1]] },
          { description: "AND(1,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1], ["B", 0]] },
          { description: "AND(1,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 1]] },
        ]}
        height={220}
        nodePositions={{
          A: { x: 0, y: 0 },
          B: { x: 0, y: 130 },
          nand1: { x: 220, y: 50 },
          nand2: { x: 420, y: 50 },
          light: { x: 600, y: 50 },
        }}
        onPass={onPass}
      />
    </section>
  );
}
