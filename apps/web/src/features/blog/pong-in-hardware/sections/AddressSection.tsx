import { CircuitEmbed } from '@simten/embed';
import { PONG_CIRCUITS } from '../circuits';

export function AddressSection() {
  const entry = PONG_CIRCUITS.pixelAddress;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        From Coordinates to Pixels
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The screen&rsquo;s DualPortRAM stores 256 pixels in a flat array. To draw at position (X,
          Y) we need the linear address Y &times; 16 + X. Multiplying by 16 is the same as shifting
          left by 4 bits, and in real hardware a left shift costs{' '}
          <strong className="text-gray-900 dark:text-white">zero gates</strong>. It&rsquo;s just{' '}
          <em>wiring</em>. Each bit of Y connects to a position four places higher in the output,
          with the low four bits tied to zero. The only actual logic gate is the final adder that
          adds X.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change <strong>x</strong> and <strong>y</strong> to see the address update instantly,
          because this is pure combinational logic with zero clock cycles.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={false}
          layout={entry.layout}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
