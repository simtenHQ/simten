import { CircuitEmbed } from '@simten/embed';
import { SORTING_CIRCUITS } from '../circuits';

export function NetworkSection() {
  const entry = SORTING_CIRCUITS.sortDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Building a Sort Network
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          String five compare-and-swaps together in the right order and you have a network that
          sorts four values in three parallel stages. This is Batcher&rsquo;s odd-even merge sort
          for <em>n</em> = 4:
        </p>

        <div className="font-mono text-sm bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-gray-700 dark:text-gray-300 space-y-1">
          <div>
            Stage 1: <span className="text-blue-500 dark:text-blue-400">(0,1)</span>{' '}
            <span className="text-blue-500 dark:text-blue-400">(2,3)</span>
          </div>
          <div>
            Stage 2: <span className="text-purple-500 dark:text-purple-400">(0,2)</span>{' '}
            <span className="text-purple-500 dark:text-purple-400">(1,3)</span>
          </div>
          <div>
            Stage 3: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span className="text-green-500 dark:text-green-400">(1,2)</span>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each pair notation <em>(i, j)</em> means &ldquo;compare elements at positions <em>i</em>{' '}
          and <em>j</em>; put the smaller at <em>i</em>.&rdquo; Pairs in the same stage have no data
          dependencies so they run simultaneously &mdash; the hardware evaluates all of Stage
          1&rsquo;s comparators at once, then all of Stage 2&rsquo;s, then Stage 3.
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The intuition behind why it works: Stage 1 sorts each pair independently (the two
          &ldquo;halves&rdquo;). Stage 2 merges the minimums together and the maximums together
          &mdash; after it, positions 0 and 3 already hold the global minimum and maximum. Stage 3
          fixes the only remaining disorder: positions 1 and 2.
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change any of the four input values below. The outputs update instantly &mdash; this
          circuit has no clock, no loop, and no conditional logic anywhere.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={false}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
