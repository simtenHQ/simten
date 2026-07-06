import { CircuitEmbed } from '@simten/embed';
import { SNAKE_CIRCUITS } from '../circuits';

export function AddressingSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        From Coordinates to Pixels
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The snake moves on a 2D grid, but the framebuffer is a flat array of 64 bytes. We convert{' '}
          <strong className="text-gray-900 dark:text-white">(X,&nbsp;Y)</strong> to a linear
          address: <code className="text-blue-300">address = (Y &laquo; 3) + X</code>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Multiplying by 8 is a left shift by 3, and in hardware a constant shift costs{' '}
          <strong className="text-gray-900 dark:text-white">zero gates</strong>. It&rsquo;s just
          wiring. Each bit of Y connects three places higher, the low three bits tied to zero. The
          only real gate is the final{' '}
          <strong className="text-gray-900 dark:text-white">Adder</strong> for X.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change X and Y below. At (3,&nbsp;2) you get address&nbsp;19, row&nbsp;2 column&nbsp;3.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.coordToPixel.circuit}
          layout={SNAKE_CIRCUITS.coordToPixel.layout}
          showControls
          title="Coordinate to Pixel Address"
          description="(Y << 3) + X. The shift is just wiring; only the final add is a real gate"
        />
      </div>
    </section>
  );
}
