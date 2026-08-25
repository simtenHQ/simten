import { lazy, Suspense } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

const SystolicDemo = lazy(() =>
  import('../SystolicDemo').then((m) => ({ default: m.SystolicDemo })),
);

function SystolicDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading systolic array simulator...</span>
      </div>
    </div>
  );
}

export function SystolicSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full 3&times;3 Systolic Array
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built (multiply-add units, weight registers, horizontal data
          pipelines, vertical partial-sum accumulation, and cycle control) comes together here. Nine
          processing elements are arranged in a 3&times;3 grid. Each PE stores one weight from
          matrix&nbsp;B. Activations from matrix&nbsp;A flow left to right through pipeline
          registers. Partial sums flow top to bottom through registered stages in each column, one
          PE per clock cycle.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit computes{' '}
          <strong className="text-gray-900 dark:text-white">C = A &times; B</strong>. Click{' '}
          <strong>Start</strong> to begin. The total latency for an N&times;N multiply is{' '}
          <strong className="text-gray-900 dark:text-white">3N cycles</strong> (9 for our
          3&times;3). Where does the 3 come from?
        </p>

        <div className="flex items-center justify-center gap-3 my-4 font-mono text-sm">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">A</div>
            <table className="border border-gray-300 dark:border-gray-600">
              {[
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
              ].map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className="w-8 h-8 text-center border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-lg">&times;</span>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">B</div>
            <table className="border border-gray-300 dark:border-gray-600">
              {[
                [2, 0, 1],
                [0, 2, 0],
                [1, 0, 2],
              ].map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className="w-8 h-8 text-center border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-purple-400"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-lg">=</span>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">C (expected)</div>
            <table className="border border-gray-300 dark:border-gray-600">
              {[
                [5, 4, 7],
                [14, 10, 16],
                [23, 16, 25],
              ].map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className="w-8 h-8 text-center border border-gray-200 dark:border-gray-700 text-green-600 dark:text-green-400 font-semibold"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
        </div>
        <ol className="text-gray-600 dark:text-gray-300 leading-relaxed list-decimal list-inside space-y-2">
          <li>
            <strong className="text-gray-900 dark:text-white">N cycles to feed data</strong>: each
            row of PEs receives N activation values, one per cycle.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">
              N&minus;1 cycles for staggered injection
            </strong>
            : because each PE&rsquo;s partial-sum output goes through a register, there&rsquo;s a
            one-cycle propagation delay per PE vertically. Row&nbsp;r must start r&nbsp;cycles late
            so its activations arrive at the same time as the partial sum traveling down from the
            row above.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">
              N cycles for vertical propagation
            </strong>
            : the partial sum must travel through N registered stages (one per PE) before the final
            result appears at the bottom.
          </li>
        </ol>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That&rsquo;s N + (N&minus;1) + N = 3N&minus;1 data cycles, plus 1 for weight loading = 3N
          total. If the vertical partial-sum path were <em>combinational</em> instead of registered
          (meaning the entire column settles in a single cycle with no propagation delay), you
          wouldn&rsquo;t need staggered injection or vertical wait time, and the total would drop to
          just <strong className="text-gray-900 dark:text-white">2N cycles</strong>. But a
          combinational chain 256 PEs deep can&rsquo;t close timing at real TPU clock speeds.
          Registers break that critical path, trading latency for a design that actually
          synthesizes.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Start</strong> and watch. The first few cycles look quiet. No results
          appear. That&rsquo;s pipeline fill: data is flowing rightward through pipeline registers
          and partial sums are building downward through registered stages, but nothing has reached
          the bottom of a column yet. Then results start appearing in a{' '}
          <strong className="text-gray-900 dark:text-white">diagonal wavefront</strong>: C[0][0]
          first (shortest path), then the next anti-diagonal, and so on until C[2][2] (longest path
          through the array). This is exactly what you&rsquo;d see on a real chip: pipeline latency,
          then a steady stream of results.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is the same fundamental architecture that powers Google&rsquo;s TPU. A real TPUv1 has
          a 256&times;256 systolic array, 65,536 processing elements performing 92 trillion 8-bit
          operations per second. The principles are identical: weights are loaded once and held
          stationary, activations flow right through pipeline registers, and partial sums accumulate
          through registered stages down each column. Staggered data injection keeps everything
          synchronized.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<SystolicDemoLoader />}>
          <Suspense fallback={<SystolicDemoLoader />}>
            <SystolicDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          What you just watched is the same process that happens inside every TPU inference. Matrix
          A holds activations from the previous layer. Matrix B holds the model&rsquo;s trained
          weights. The systolic array computes the matrix product in a pipelined wavefront: weights
          are loaded once, then activations stream through at full speed. The result feeds into the
          next layer. Repeat for every layer in the network.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The systolic design is powerful because it maximizes data reuse. Each activation value is
          read once from memory and multiplied by every weight in its row as it flows rightward.
          Each weight is loaded once and used for every activation that passes through its PE over
          time. This dramatically reduces memory bandwidth, the bottleneck that limits GPU
          performance on large language models.
        </p>
      </div>
    </section>
  );
}
