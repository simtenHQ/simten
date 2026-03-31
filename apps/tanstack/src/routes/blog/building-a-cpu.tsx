import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/building-a-cpu/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const GatesSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/GatesSection").then((m) => ({ default: m.GatesSection }))
);
const CompositionSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/CompositionSection").then((m) => ({
    default: m.CompositionSection,
  }))
);
const MemorySection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/MemorySection").then((m) => ({
    default: m.MemorySection,
  }))
);
const CounterSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/CounterSection").then((m) => ({
    default: m.CounterSection,
  }))
);
const AdderSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/AdderSection").then((m) => ({
    default: m.AdderSection,
  }))
);
const ALUSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/ALUSection").then((m) => ({
    default: m.ALUSection,
  }))
);
const RAMSection = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/RAMSection").then((m) => ({
    default: m.RAMSection,
  }))
);
const CPU6502Section = lazy(() =>
  import("@/features/blog/building-a-cpu/sections/CPU6502Section").then((m) => ({
    default: m.CPU6502Section,
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

function BuildingACPUPage() {
  return (
    <>

        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <GatesSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CompositionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <MemorySection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CounterSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <AdderSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ALUSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RAMSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CPU6502Section />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="building-a-cpu" tagline="Every circuit on this page is simulated from NAND gates in your browser. No shortcuts, no abstractions, no cheating." />
    </>
  );
}

export const Route = createFileRoute('/blog/building-a-cpu')({
  head: () => ({
    meta: [
      { title: 'Building a CPU from Scratch | Turing Incomplete' },
      {
        name: 'description',
        content:
          'An interactive guide from NAND gates to a working 6502 CPU running C code. Every circuit is live — click switches, watch signals propagate, and build intuition for how computers work.',
      },
    ],
  }),
  component: BuildingACPUPage,
})
