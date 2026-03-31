import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/snake-in-hardware/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const PixelsSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/PixelsSection").then((m) => ({
    default: m.PixelsSection,
  }))
);
const AddressingSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/AddressingSection").then((m) => ({
    default: m.AddressingSection,
  }))
);
const DirectionSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/DirectionSection").then((m) => ({
    default: m.DirectionSection,
  }))
);
const MovementSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/MovementSection").then((m) => ({
    default: m.MovementSection,
  }))
);
const PhaseSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/PhaseSection").then((m) => ({
    default: m.PhaseSection,
  }))
);
const CollisionSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/CollisionSection").then((m) => ({
    default: m.CollisionSection,
  }))
);
const SnakeSection = lazy(() =>
  import("@/features/blog/snake-in-hardware/sections/SnakeSection").then((m) => ({
    default: m.SnakeSection,
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

function SnakeInHardwarePage() {
  return (
    <>
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PixelsSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <AddressingSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <DirectionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <MovementSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PhaseSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CollisionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <SnakeSection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="snake-in-hardware" />
    </>
  );
}

export const Route = createFileRoute('/blog/snake-in-hardware')({
  head: () => ({
    meta: [
      { title: 'Snake in Hardware | Turing Incomplete' },
      {
        name: 'description',
        content:
          'A complete Snake game built entirely from logic gates, registers, and memory — no CPU, no software, just digital circuits. Every circuit is live and interactive.',
      },
    ],
  }),
  component: SnakeInHardwarePage,
})
