
import { CircuitEmbed } from "@turing-incomplete/embed";
import { CHACHA20_CIRCUITS } from "../circuits";

export function ARXSection() {
  const entry = CHACHA20_CIRCUITS.arxDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Three Operations. That&rsquo;s It.
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          ChaCha20 belongs to a family of ciphers called <strong>ARX</strong> &mdash;
          built entirely from <strong>A</strong>ddition, <strong>R</strong>otation,
          and <strong>X</strong>OR. No S-boxes, no lookup tables, no multiplication.
          This makes it extremely fast in software <em>and</em> cheap in hardware.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong>ADD</strong> mixes bits by carrying &mdash; a change in one bit
          can cascade through the entire word. <strong>XOR</strong> mixes bits
          independently without carries. Together, they create both local and
          non-local diffusion across the 32-bit word.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing the input values below (decimal). The <code>Adder</code>{" "}
          produces a modular sum (wrapping at 2<sup>32</sup>), while{" "}
          <code>BusXor</code> flips bits independently. Notice how the outputs
          are shown in hex &mdash; the same 32 bits, just a more convenient
          representation at this scale.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={280}
          showControls={false}
          displayCode={entry.displayCode}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
