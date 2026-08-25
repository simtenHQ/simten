import { CircuitEmbed } from '@simten/embed';
import { BLOG_CIRCUITS } from '../circuits';

export function HazardsSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Hard Part: Hazards
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Pipelining sounds clean in theory. In practice, instructions depend on each other.
          Consider:
        </p>

        <div className="rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 font-mono text-sm text-gray-500 dark:text-gray-300">
          <div>
            <span className="text-purple-400">add</span> a0, a1, a2{' '}
            <span className="text-gray-600">// a0 = a1 + a2</span>
          </div>
          <div>
            <span className="text-purple-400">sub</span> a3, a0, a4{' '}
            <span className="text-gray-600">// a3 = a0 - a4 &larr; needs a0!</span>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The{' '}
          <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
            sub
          </code>{' '}
          needs the result of{' '}
          <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
            add
          </code>
          , but in a pipeline,{' '}
          <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
            sub
          </code>{' '}
          enters the Decode stage while{' '}
          <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
            add
          </code>{' '}
          is still in Execute. The result hasn&rsquo;t been written back to the register file yet.
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is a <strong className="text-gray-900 dark:text-white">data hazard</strong>. There
          are two solutions:
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Stalling</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Freeze the pipeline for a cycle until the result is available. Simple but wastes a
              cycle. Our hazard unit does this for{' '}
              <strong className="text-gray-600 dark:text-gray-300">load-use</strong> hazards: when a
              value is being loaded from memory, it&rsquo;s not ready until the Memory stage
              completes.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Forwarding</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don&rsquo;t wait for writeback. Grab the result directly from whichever stage computed
              it and feed it back to the Execute stage through a{' '}
              <strong className="text-gray-600 dark:text-gray-300">forwarding mux</strong>. No stall
              needed, and the pipeline keeps flowing.
            </p>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong className="text-gray-900 dark:text-white">Control hazards</strong> are the other
          problem. When a branch is taken, the instructions that were already fetched after it are
          wrong. The pipeline flushes them, replacing them with NOPs, and restarts from the branch
          target. That&rsquo;s what the flush input on the pipeline registers does.
        </p>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          The Forwarding Mux
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Two bits select the source: 00&nbsp;=&nbsp;register file (no hazard),
          01&nbsp;=&nbsp;forward from EX stage, 10&nbsp;=&nbsp;forward from MEM stage. The
          forwarding unit sets these bits automatically by comparing register addresses across
          pipeline stages.
        </p>
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.forwardingMux.circuit}
          title="Forwarding Mux"
          description="sel: 00=register 01=EX forward 10=MEM forward"
        />
      </div>
    </section>
  );
}
