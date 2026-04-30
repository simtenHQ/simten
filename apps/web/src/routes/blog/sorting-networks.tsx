import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/sorting-networks/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const CompareSwapSection = lazy(() =>
  import("@/features/blog/sorting-networks/sections/CompareSwapSection").then((m) => ({
    default: m.CompareSwapSection,
  }))
);
const NetworkSection = lazy(() =>
  import("@/features/blog/sorting-networks/sections/NetworkSection").then((m) => ({
    default: m.NetworkSection,
  }))
);
const PipelineSection = lazy(() =>
  import("@/features/blog/sorting-networks/sections/PipelineSection").then((m) => ({
    default: m.PipelineSection,
  }))
);
const WhyHardwareSection = lazy(() =>
  import("@/features/blog/sorting-networks/sections/WhyHardwareSection").then((m) => ({
    default: m.WhyHardwareSection,
  }))
);

function SectionSkeleton() {
  return (
    <div className="py-12 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-full" />
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-5/6" />
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-4/6" />
      </div>
      <div className="mt-8 h-64 bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800" />
    </div>
  );
}

function SortingNetworksPage() {
  return (
    <>
      <HeroSection />

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <CompareSwapSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <NetworkSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PipelineSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <WhyHardwareSection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter slug="sorting-networks" />
    </>
  );
}

export const Route = createFileRoute('/blog/sorting-networks')({
  head: () => ({
    meta: [
      { title: 'Sorting Networks | Simten' },
      {
        name: 'description',
        content:
          'A fixed wiring of comparators that sorts any input in the same number of steps — no branches, no loops. The algorithm behind network switch fabrics, GPU sort, and median filters.',
      },
    ],
  }),
  component: SortingNetworksPage,
})
