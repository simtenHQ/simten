"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { BLOG_CIRCUITS } from "../circuits";

export function ALUSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The ALU: A Calculator Chip
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          An adder can only add. A real CPU needs to do logic too &mdash; AND,
          OR, XOR. The{" "}
          <strong className="text-gray-900 dark:text-white">
            Arithmetic Logic Unit
          </strong>{" "}
          (ALU) computes <em>all</em> of these in parallel and uses a{" "}
          <strong className="text-gray-900 dark:text-white">multiplexer</strong> to pick the result
          based on a control signal.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Below is a 1-bit ALU slice. It has an adder, AND, OR, and XOR gate
          all wired to the same inputs. The two <strong>op</strong> switches
          select which result passes through: 00&nbsp;=&nbsp;ADD,
          01&nbsp;=&nbsp;AND, 10&nbsp;=&nbsp;OR, 11&nbsp;=&nbsp;XOR.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Chain 8 of these slices (with carry linking the adders) and you have
          the complete ALU of the 6502. The CPU&rsquo;s control unit just sets
          the <strong>op</strong> bits based on which instruction it decoded.
          Same circuit, different operation &mdash; that&rsquo;s what makes it
          programmable.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.alu1bit.circuit}
          displayCode={BLOG_CIRCUITS.alu1bit.displayCode}
          height={380}
          title="1-Bit ALU Slice"
          description="op: 00=ADD 01=AND 10=OR 11=XOR"
        />
      </div>
    </section>
  );
}
