"use client";

import { InlineChallenge } from "../../components/InlineChallenge";

interface OrChallengeSectionProps {
  onPass: () => void;
}

export function OrChallengeSection({ onPass }: OrChallengeSectionProps) {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Challenge 3: Build OR
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This one requires a mental leap. De Morgan&rsquo;s law says:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`A OR B  =  NOT(NOT(A) AND NOT(B))
        =  NAND(NOT(A), NOT(B))`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In words: invert each input separately, then NAND the results together.
          Three NAND gates total &mdash; two for the inversions (NOT trick),
          one to combine them.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Think about why this works: NAND(NOT A, NOT B) is 0 only when
          both NOT A <em>and</em> NOT B are 1 &mdash; meaning both A and B
          are 0. Every other case gives 1. That&rsquo;s OR.
        </p>
      </div>

      <InlineChallenge
        title="OR from NAND"
        objective="Three NAND gates: notA inverts A, notB inverts B, combine NANDs the results."
        hints={[
          "notA: connect A.out to both inputs.",
          "notB: connect B.out to both inputs.",
          "combine: connect notA.out to combine.a, notB.out to combine.b.",
        ]}
        scaffold={`
const OrFromNand = component('OrFromNand', {
  nodes: { A: Switch, B: Switch, notA: Nand, notB: Nand, combine: Nand, light: Led },
})
`}
        checks={[
          { description: "OR(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
          { description: "OR(0,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0], ["B", 1]] },
          { description: "OR(1,0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 0]] },
          { description: "OR(1,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 1]] },
        ]}
        height={260}
        nodePositions={{
          A: { x: 0, y: 0 },
          B: { x: 0, y: 160 },
          notA: { x: 200, y: 0 },
          notB: { x: 200, y: 160 },
          combine: { x: 400, y: 70 },
          light: { x: 590, y: 70 },
        }}
        onPass={onPass}
      />
    </section>
  );
}
