import { lazy, Suspense } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

const SwitchDemo = lazy(() => import('../SwitchDemo').then((m) => ({ default: m.SwitchDemo })));

function SwitchDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading network switch circuit...</span>
      </div>
    </div>
  );
}

export function SwitchSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full 2-Port Switch
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built (frame detection, packet buffering, fair arbitration,
          crossbar routing, and byte serialization) comes together in one circuit. The full{' '}
          <strong className="text-gray-900 dark:text-white">MiniSwitch2Port</strong> has two
          complete data paths, each with its own parser, ingress controller, and egress controller,
          connected through a shared arbiter and forwarder.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Send Packet</strong> on either port to inject a full Ethernet frame
          (preamble + 8 data bytes). The circuit parses the frame, buffers it, wins arbitration,
          routes it across the crossbar to the opposite port, and serializes it out. Watch the
          activity log to follow each byte through the pipeline.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try sending on both ports to see the arbiter alternate fairly. Use{' '}
          <strong>Free Run</strong> to let the switch tick continuously, or <strong>Step</strong> to
          advance one clock cycle at a time.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<SwitchDemoLoader />}>
          <Suspense fallback={<SwitchDemoLoader />}>
            <SwitchDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is a simplified but structurally accurate model of how real network switches work.
          Production switches use wider buses, deeper buffers, and more sophisticated routing
          tables, but the architecture is the same: parse, buffer, arbitrate, route, serialize.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The key insight is that a switch is not a computer running networking software. It&rsquo;s
          a <em>circuit</em> that performs packet forwarding in hardware. Every stage runs
          concurrently: while one packet is being serialized out of port 0, another can be parsed
          and buffered on port 1. This pipeline parallelism is why hardware switches can forward
          millions of packets per second, far faster than any software router.
        </p>
      </div>
    </section>
  );
}
