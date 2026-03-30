import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/how-tpus-work/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const MACSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/MACSection").then((m) => ({ default: m.MACSection }))
);
const WeightSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/WeightSection").then((m) => ({
    default: m.WeightSection,
  }))
);
const PESection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/PESection").then((m) => ({ default: m.PESection }))
);
const DataFlowSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/DataFlowSection").then((m) => ({
    default: m.DataFlowSection,
  }))
);
const WeightFlowSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/WeightFlowSection").then((m) => ({
    default: m.WeightFlowSection,
  }))
);
const PhaseSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/PhaseSection").then((m) => ({
    default: m.PhaseSection,
  }))
);
const SystolicSection = lazy(() =>
  import("@/features/blog/how-tpus-work/sections/SystolicSection").then((m) => ({
    default: m.SystolicSection,
  }))
);

function SectionSkeleton() {
  return (
    <div className="py-12 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-64 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-800/50 rounded w-full" />
        <div className="h-4 bg-gray-800/50 rounded w-5/6" />
        <div className="h-4 bg-gray-800/50 rounded w-4/6" />
      </div>
      <div className="mt-8 h-64 bg-gray-900/50 rounded-xl border border-gray-800" />
    </div>
  );
}

function HowTPUsWorkPage() {
  return (
    <>

        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <MACSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <WeightSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PESection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <DataFlowSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <WeightFlowSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PhaseSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <SystolicSection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="how-tpus-work" />
    </>
  );
}

export const Route = createFileRoute('/blog/how-tpus-work')({
  head: () => ({
    meta: [
      { title: 'How TPUs Do Calculations | Turing Incomplete' },
      {
        name: 'description',
        content:
          'Inside Google\'s Tensor Processing Units: a 2x2 systolic array built from logic gates. Watch matrix multiplication happen one clock cycle at a time.',
      },
    ],
  }),
  component: HowTPUsWorkPage,
})
