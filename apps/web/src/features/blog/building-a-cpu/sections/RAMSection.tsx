import { CircuitEmbed } from '@simten/embed';
import { BLOG_CIRCUITS } from '../circuits';

export function RAMSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">RAM</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Registers hold a handful of values. Programs need <em>thousands</em> of bytes, each at its
          own address, and that&rsquo;s what{' '}
          <strong className="text-gray-900 dark:text-white">RAM</strong> is for. Put an address in
          and the byte stored there comes out.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          In this RAM,{' '}
          <strong className="text-gray-900 dark:text-white">reading happens straight away</strong>{' '}
          and <strong className="text-gray-900 dark:text-white">writing waits for a tick</strong>.
          Change <strong>addr</strong> and <strong>data_out</strong> follows. To write, set{' '}
          <strong>addr</strong> and <strong>data_in</strong>, turn <strong>we</strong> (write
          enable) on, and click <strong>Tick</strong>. Then turn <strong>we</strong> off and change
          the address to read it back.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Write 42 to address 1 and 7 to address 2, then switch between the two addresses to read
          them back. The 6502 computer at the end of this post has 2,048 bytes of RAM instead of
          256, wired up the same way.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.ram.circuit}
          showControls
          title="256×8 RAM"
          description="Reads are instant. Writes happen on Tick with we=ON."
        />
      </div>
    </section>
  );
}
