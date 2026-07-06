export function WhyHardwareSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Why Hardware Needs Sorting Networks
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A software sort like quicksort or mergesort has data-dependent branches and pointer
          chasing through memory. The CPU must predict which branch to take, stall on cache misses,
          and retire instructions one at a time through the reorder buffer. Latency is
          unpredictable, and pipelining across the sort boundary is difficult.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A sorting network sidesteps all of that. The wiring is fixed at design time &mdash; no
          control flow, no memory access pattern that depends on the data. Every comparator in each
          stage evaluates in parallel. The depth of the network (the number of sequential stages) is
          O(log&sup2; <em>n</em>), so a 16-element Batcher network needs only 10 stages. Timing is
          completely deterministic.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong className="text-gray-900 dark:text-white">Batcher-Banyan switch fabrics</strong>{' '}
          wired sorting networks together in ATM switches during the 1990s. A Batcher sorter ranked
          incoming cells by destination address; a Banyan network then routed them conflict-free.
          The whole switch ran at line rate because every path through the silicon took exactly the
          same number of gate delays.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong className="text-gray-900 dark:text-white">Median filters</strong> in
          image-processing ASICs use small sorting networks (typically 9 or 25 elements for
          3&times;3 or 5&times;5 kernels) to extract the median pixel value without distorting edges
          the way a blur would. Sorting every 3&times;3 neighborhood in software would be a
          branch-heavy inner loop; in silicon it is just wires and comparators that run every pixel
          clock.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong className="text-gray-900 dark:text-white">GPU sort pipelines</strong> (Bitonic
          sort, Odd-even merge sort) use sorting networks as the inner kernel. A wavefront of
          threads each owns a small slice; the fixed compare-and-swap pattern maps cleanly onto SIMD
          lanes because every thread executes the same instruction at the same time &mdash; no
          divergence, maximum throughput.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Finally, a pipelined sorting network achieves sustained throughput of{' '}
          <strong className="text-gray-900 dark:text-white">one sort per clock cycle</strong>. Add a
          register stage between each comparator layer and you can feed a new set of values every
          tick. Our 4-element network has 3 stages, so after 3 cycles of latency the first sorted
          result arrives &mdash; and then one arrives every cycle thereafter. Software can never
          match that for fixed-size inputs.
        </p>
      </div>
    </section>
  );
}
