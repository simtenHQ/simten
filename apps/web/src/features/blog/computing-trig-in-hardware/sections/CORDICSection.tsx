import { lazy, Suspense } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

const CORDICDemo = lazy(() => import('../CORDICDemo').then((m) => ({ default: m.CORDICDemo })));

function CORDICDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading CORDIC circuit...</span>
      </div>
    </div>
  );
}

export function CORDICSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full CORDIC Engine
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; right shifters, signed arithmetic, direction
          detection, iteration control, and the angle lookup table &mdash; comes together in one
          circuit. The full{' '}
          <strong className="text-gray-900 dark:text-white">CORDICIteration</strong> engine starts
          with a vector (80,&nbsp;0) pointing right and rotates it 45&deg;.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Run</strong> or step through the iterations one by one. Watch x decrease and
          y increase as the vector rotates. After 8 iterations, both x and y should be approximately
          equal &mdash; confirming that cos(45&deg;) &asymp; sin(45&deg;).
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<CORDICDemoLoader />}>
          <Suspense fallback={<CORDICDemoLoader />}>
            <CORDICDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The final values are scaled by the CORDIC gain factor (K&nbsp;&asymp;&nbsp;1.647), so the
          raw outputs are larger than the true sine and cosine. In production hardware, a single
          constant multiplication at the end corrects for this. But the core computation &mdash; 8
          iterations of shift-and-add &mdash; runs with zero multipliers.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is the same algorithm inside your scientific calculator, the trigonometric units of
          early GPUs, and every DSP chip that needs fast angle computation. No Taylor series, no
          lookup table interpolation &mdash; just wires, registers, and a shifter.
        </p>
      </div>
    </section>
  );
}
