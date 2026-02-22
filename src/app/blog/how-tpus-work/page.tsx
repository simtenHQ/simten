import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "@/app/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const MACSection = lazy(() =>
  import("./sections/MACSection").then((m) => ({ default: m.MACSection }))
);
const WeightSection = lazy(() =>
  import("./sections/WeightSection").then((m) => ({
    default: m.WeightSection,
  }))
);
const PESection = lazy(() =>
  import("./sections/PESection").then((m) => ({ default: m.PESection }))
);
const DataFlowSection = lazy(() =>
  import("./sections/DataFlowSection").then((m) => ({
    default: m.DataFlowSection,
  }))
);
const WeightFlowSection = lazy(() =>
  import("./sections/WeightFlowSection").then((m) => ({
    default: m.WeightFlowSection,
  }))
);
const PhaseSection = lazy(() =>
  import("./sections/PhaseSection").then((m) => ({
    default: m.PhaseSection,
  }))
);
const SystolicSection = lazy(() =>
  import("./sections/SystolicSection").then((m) => ({
    default: m.SystolicSection,
  }))
);

export const metadata: Metadata = {
  title: "How TPUs Do Calculations | Turing Incomplete",
  description:
    "Inside Google's Tensor Processing Units: a 2×2 systolic array built from logic gates. Watch matrix multiplication happen one clock cycle at a time.",
  openGraph: {
    title: "How TPUs Do Calculations",
    description:
      "A 2×2 systolic array built from logic gates — every circuit is live and interactive.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "How TPUs Do Calculations",
    description:
      "A 2×2 systolic array built from logic gates — every circuit is live and interactive.",
  },
};

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

export default function HowTPUsWorkPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
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

        {/* Footer */}
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
            browser. No shortcuts, no abstractions, no cheating.
          </p>
        </footer>
      </main>
    </div>
  );
}
