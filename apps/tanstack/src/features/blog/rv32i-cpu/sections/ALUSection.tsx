"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { BLOG_CIRCUITS } from "../circuits";

export function ALUSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The ALU
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The <strong className="text-gray-900 dark:text-white">Arithmetic Logic Unit</strong> is
          the core of the Execute stage. RV32I needs 10 operations: add,
          subtract, AND, OR, XOR, shift left, shift right (logical and
          arithmetic), set-less-than (signed and unsigned).
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          All 10 operations compute in parallel on the same inputs. A
          multiplexer at the output picks the right result based on the ALU
          control signal derived from the instruction&rsquo;s opcode and
          function fields.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Here&rsquo;s a simplified 8-bit version with 4 operations. The
          full RV32I ALU works the same way, just wider (32 bits) and with
          more operations.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={BLOG_CIRCUITS.aluSlice.dsl}
          displayDsl={BLOG_CIRCUITS.aluSlice.displayDsl}
          height={400}
          title="8-bit ALU"
          description="op: 00=ADD 01=SUB 10=AND 11=OR"
        />
      </div>
    </section>
  );
}
