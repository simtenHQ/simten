import { CircuitEmbed } from '@simten/embed';
import { SNAKE_CIRCUITS } from '../circuits';

export function PixelsSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Pixels &amp; Memory</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The screen is just memory. One byte per pixel across an 8&times;8 grid, and setting a byte
          to 1 lights that pixel up. The catch: the game has to write pixels while the display reads
          them, at the same time. A{' '}
          <strong className="text-gray-900 dark:text-white">DualPortRAM</strong> gives us exactly
          that, two independent windows into one block of memory. Port A is where game logic reads
          and writes; port B feeds the{' '}
          <strong className="text-gray-900 dark:text-white">Screen</strong>, which scans the
          addresses to draw the grid.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Addresses run left to right, top to bottom: 0 is top-left, 7 is top-right, 63 is
          bottom-right. The pattern below draws a border.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Toggle <strong>write-enable</strong>, set an address and data, then <strong>Tick</strong>{' '}
          to write a pixel; the HexDisplay shows what reads back. Snake runs this same cycle every
          frame.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.simpleFramebuffer.circuit}
          layout={SNAKE_CIRCUITS.simpleFramebuffer.layout}
          showControls
          title="Simple Framebuffer"
          description="DualPortRAM + Screen: toggle write-enable, set address and data, then tick to write a pixel"
        />
      </div>
    </section>
  );
}
