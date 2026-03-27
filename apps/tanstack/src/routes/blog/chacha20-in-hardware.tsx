import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/chacha20-in-hardware/sections/HeroSection";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const ARXSection = lazy(() =>
  import("@/features/blog/chacha20-in-hardware/sections/ARXSection").then((m) => ({ default: m.ARXSection }))
);
const RotateSection = lazy(() =>
  import("@/features/blog/chacha20-in-hardware/sections/RotateSection").then((m) => ({ default: m.RotateSection }))
);
const StepSection = lazy(() =>
  import("@/features/blog/chacha20-in-hardware/sections/StepSection").then((m) => ({ default: m.StepSection }))
);
const QuarterRoundSection = lazy(() =>
  import("@/features/blog/chacha20-in-hardware/sections/QuarterRoundSection").then((m) => ({ default: m.QuarterRoundSection }))
);
const BigPictureSection = lazy(() =>
  import("@/features/blog/chacha20-in-hardware/sections/BigPictureSection").then((m) => ({ default: m.BigPictureSection }))
);

export const Route = createFileRoute('/blog/chacha20-in-hardware')({
  head: () => ({
    meta: [
      { title: 'ChaCha20 in Hardware | Turing Incomplete' },
      { name: 'description', content: 'The TLS cipher that encrypts most of the internet, built from logic gates. Explore the ADD-XOR-ROTATE quarter-round with live interactive circuits.' },
    ],
  }),
  component: ChaCha20InHardwarePage,
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
      <div className="mt-8 h-64 bg-gray-900/50 rounded-xl border border-gray-800" />
    </div>
  );
}

function ChaCha20InHardwarePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ARXSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RotateSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <StepSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <QuarterRoundSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BigPictureSection />
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
