"use client";

import { InlineChallenge } from "../../components/InlineChallenge";

export function XorChallengeSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Challenge 4: Build XOR
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          XOR outputs 1 when the inputs are <strong>different</strong>. This is
          the hardest one yet &mdash; four NAND gates. But the payoff is huge:
          XOR is addition without carry. It&rsquo;s the gate that makes arithmetic
          possible.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The trick: start with NAND(A,B) &mdash; call it <code>mid</code>.
          Then:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 text-sm font-mono text-gray-200 overflow-x-auto">
{`mid   = NAND(A, B)
left  = NAND(A, mid)
right = NAND(mid, B)
out   = NAND(left, right)`}</pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Trace it through mentally for A=1, B=0: mid=NAND(1,0)=1,
          left=NAND(1,1)=0, right=NAND(1,0)=1, out=NAND(0,1)=1. Correct!
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          If you can build this, you understand how <strong>every logic gate
          in a CPU</strong> is constructed. This is the foundation.
        </p>
      </div>

      <InlineChallenge
        title="XOR from NAND"
        objective="Four NAND gates. The LED lights when exactly one switch is ON."
        hints={[
          "Start with mid: connect A.out -> mid.a and B.out -> mid.b",
          "left: connect A.out -> left.a and mid.out -> left.b",
          "right: connect mid.out -> right.a and B.out -> right.b",
          "final: connect left.out -> final.a and right.out -> final.b, then final.out -> light.in",
        ]}
        scaffold={`circuit XorFromNand {
  impl {
    node A: Switch
    node B: Switch
    node mid: Nand
    node left: Nand
    node right: Nand
    node final: Nand
    node light: Led

    // Your connections here:

  }
}`}
        checks={[
          { description: "XOR(0,0) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 0], ["B", 0]] },
          { description: "XOR(0,1) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 0], ["B", 1]] },
          { description: "XOR(1,0) = 1", node: "light", port: "in", expected: 1, inputs: [["A", 1], ["B", 0]] },
          { description: "XOR(1,1) = 0", node: "light", port: "in", expected: 0, inputs: [["A", 1], ["B", 1]] },
        ]}
        height={280}
        nodePositions={{
          A: { x: 0, y: 0 },
          B: { x: 0, y: 200 },
          mid: { x: 190, y: 90 },
          left: { x: 370, y: 10 },
          right: { x: 370, y: 170 },
          final: { x: 550, y: 90 },
          light: { x: 720, y: 90 },
        }}
      />

      <div className="mt-8 rounded-lg border border-emerald-800/40 bg-emerald-900/10 p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          You Just Proved Functional Completeness
        </h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          NOT, AND, OR, XOR &mdash; all from a single gate type. In 1913,
          Henry Sheffer proved this was possible. You just did it yourself.
          Every circuit in every computer &mdash; from a pocket calculator to
          a GPU rendering a video game &mdash; is built from this same foundation.
          The difference is just scale: a modern CPU has billions of these gates.
          The logic is identical.
        </p>
      </div>
    </section>
  );
}
