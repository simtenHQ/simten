import { useCircuitSimulator } from '@simten/embed';
import { CircuitCanvas } from '@simten/ui/canvas';
import { PipelinedSortDemo } from '../circuits';

export function PipelineSection() {
  const sim = useCircuitSimulator(PipelinedSortDemo);

  // Read output values from portValues; keys are like "sorter.s0", "sorter.s1", etc.
  const getOutputValue = (key: string): number => {
    if (!sim.portValues) return 0;
    const direct = sim.portValues.get(key);
    if (direct !== undefined && typeof direct === 'number') return direct;
    // Fallback: scan for a key ending with the suffix
    for (const [k, v] of sim.portValues) {
      if (k.endsWith(key)) return typeof v === 'number' ? v : 0;
    }
    return 0;
  };

  const s0 = getOutputValue('sorter.s0');
  const s1 = getOutputValue('sorter.s1');
  const s2 = getOutputValue('sorter.s2');
  const s3 = getOutputValue('sorter.s3');

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Adding a Pipeline</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The combinational network above sorts instantly, but it can only process one set of inputs
          at a time. While the comparators are busy evaluating one frame of values, no new data can
          enter.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The fix is straightforward: insert a <strong>register bank</strong> between each
          comparator stage. Registers capture the intermediate results on every clock edge, so the
          three stages become independent. Stage 1 can start sorting a new set of inputs at the same
          moment Stage 2 is processing the previous set and Stage 3 is finishing the one before
          that.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The first sorted result takes 3 clock cycles to emerge, one per stage. But after that
          initial latency, a new sorted result arrives <strong>every single cycle</strong>.
          Throughput is 1 sort/cycle regardless of how long the combinational logic inside each
          stage takes. This is exactly how real FPGA and ASIC sort engines are built.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Step through the circuit below and watch the values propagate stage by stage. After 3
          ticks the outputs stabilize into ascending order; every tick after that could carry a
          completely different input batch through the same pipeline.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
        {!sim.ready && (
          <div className="p-8">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-400" />
              <span className="text-sm">Compiling pipelined circuit...</span>
            </div>
          </div>
        )}

        {sim.ready && (
          <>
            {/* Output values header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sorted outputs
                  </span>
                  <div className="font-mono text-gray-700 dark:text-gray-300 mt-1 flex gap-4">
                    <span>
                      s0 = <span className="text-blue-600 dark:text-blue-400">{s0}</span>
                    </span>
                    <span>
                      s1 = <span className="text-blue-600 dark:text-blue-400">{s1}</span>
                    </span>
                    <span>
                      s2 = <span className="text-blue-600 dark:text-blue-400">{s2}</span>
                    </span>
                    <span>
                      s3 = <span className="text-blue-600 dark:text-blue-400">{s3}</span>
                    </span>
                  </div>
                </div>
                {sim.cycleCount >= 3 && (
                  <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                    Pipeline full &middot; 1 sort/cycle
                  </span>
                )}
              </div>
            </div>

            {/* Circuit canvas */}
            <CircuitCanvas
              circuit={sim.circuit}
              componentLibrary={sim.componentLibrary ?? undefined}
              portValues={sim.portValues}
              sequentialState={sim.sequentialState}
              onToggleNode={sim.toggleNode}
              onSetNodeValue={sim.setNodeValue}
              height={400}
            />

            {/* Controls bar */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-gray-900/90">
              <button
                onClick={sim.tick}
                className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Step
              </button>
              <button
                onClick={sim.reset}
                className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
              >
                Reset
              </button>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                Cycle {sim.cycleCount}
                {sim.cycleCount < 3 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    ({3 - sim.cycleCount} cycle{3 - sim.cycleCount !== 1 ? 's' : ''} until first
                    result)
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
