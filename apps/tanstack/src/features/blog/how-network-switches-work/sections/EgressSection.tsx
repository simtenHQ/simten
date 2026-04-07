
import { CircuitEmbed } from "@turing-incomplete/embed";
import { SWITCH_CIRCUITS } from "../circuits";

export function EgressSection() {
  const entry = SWITCH_CIRCUITS.packetSerializer;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Serializing the Output
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Once the forwarder copies packet data into the egress buffer, the{" "}
          <strong className="text-gray-900 dark:text-white">egress controller</strong> reads it
          back out one byte at a time. A{" "}
          <strong className="text-gray-900 dark:text-white">read pointer</strong> register steps
          through the RAM addresses, outputting each byte with a valid signal.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The RAM is pre-loaded with 8 bytes of test data: 0xAA, 0xBB, 0xCC,
          etc. Toggle the <strong>enable</strong> switch and tick repeatedly to
          watch the pointer advance through the data. When the pointer reaches
          7, the <strong>doneLed</strong> lights up &mdash; the packet is fully
          serialized.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In the full switch, this same mechanism operates on each output port
          independently &mdash; both ports can serialize their egress buffers
          simultaneously.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          height={280}
          showControls
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
