import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/breakout-in-hardware/sections/HeroSection";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const PaddleSection = lazy(() =>
  import("@/features/blog/breakout-in-hardware/sections/PaddleSection").then((m) => ({ default: m.PaddleSection }))
);
const BallSection = lazy(() =>
  import("@/features/blog/breakout-in-hardware/sections/BallSection").then((m) => ({ default: m.BallSection }))
);
const BricksSection = lazy(() =>
  import("@/features/blog/breakout-in-hardware/sections/BricksSection").then((m) => ({ default: m.BricksSection }))
);
const PipelineSection = lazy(() =>
  import("@/features/blog/breakout-in-hardware/sections/PipelineSection").then((m) => ({ default: m.PipelineSection }))
);
const BreakoutSection = lazy(() =>
  import("@/features/blog/breakout-in-hardware/sections/BreakoutSection").then((m) => ({ default: m.BreakoutSection }))
);

export const Route = createFileRoute('/blog/breakout-in-hardware')({
  head: () => ({
    meta: [
      { title: 'Breakout in Hardware | Turing Incomplete' },
      { name: 'description', content: 'A complete Breakout game built from logic gates — paddle, ball, bricks, and a 10-phase rendering pipeline, all without a CPU.' },
    ],
  }),
  component: BreakoutInHardwarePage,
})

function SectionSkeleton() {
  return (
    <div className="py-12 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-64 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-800/50 rounded w-full" />
        <div className="h-4 bg-gray-800/50 rounded w-5/6" />
        <div className="h-4 bg-gray-800/50 rounded w-4/6" />
      </div>
    </div>
  );
}

function BreakoutInHardwarePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PaddleSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BallSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BricksSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PipelineSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BreakoutSection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">
            Built with{" "}
            <a
              href="/"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Turing Incomplete
            </a>
            {" "}&mdash; a visual circuit simulator with an AI tutor.
          </p>
          <p className="text-xs text-gray-600 mt-2">
            <a href="/blog" className="hover:text-gray-400 transition-colors">
              &larr; Back to blog
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}
