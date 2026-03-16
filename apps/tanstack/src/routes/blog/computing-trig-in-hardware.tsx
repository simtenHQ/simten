import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/computing-trig-in-hardware/sections/HeroSection";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const ShiftSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/ShiftSection").then((m) => ({
    default: m.ShiftSection,
  }))
);
const RotationSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/RotationSection").then((m) => ({
    default: m.RotationSection,
  }))
);
const DirectionSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/DirectionSection").then((m) => ({
    default: m.DirectionSection,
  }))
);
const IterationSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/IterationSection").then((m) => ({
    default: m.IterationSection,
  }))
);
const LookupSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/LookupSection").then((m) => ({
    default: m.LookupSection,
  }))
);
const CORDICSection = lazy(() =>
  import("@/features/blog/computing-trig-in-hardware/sections/CORDICSection").then((m) => ({
    default: m.CORDICSection,
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

function ComputingTrigPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ShiftSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RotationSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <DirectionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <IterationSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <LookupSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CORDICSection />
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
            Every circuit on this page is simulated from logic gates in your
            browser. No CPU, no software, no cheating.
          </p>
        </footer>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/blog/computing-trig-in-hardware')({
  head: () => ({
    meta: [
      { title: 'Computing Trig in Hardware | Turing Incomplete' },
      {
        name: 'description',
        content:
          'How calculators and GPUs compute sine and cosine using only bit shifts and addition — the CORDIC algorithm, built from logic gates in your browser.',
      },
    ],
  }),
  component: ComputingTrigPage,
})
