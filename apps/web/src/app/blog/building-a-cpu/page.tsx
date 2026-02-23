import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "./ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const GatesSection = lazy(() =>
  import("./sections/GatesSection").then((m) => ({ default: m.GatesSection }))
);
const CompositionSection = lazy(() =>
  import("./sections/CompositionSection").then((m) => ({
    default: m.CompositionSection,
  }))
);
const MemorySection = lazy(() =>
  import("./sections/MemorySection").then((m) => ({
    default: m.MemorySection,
  }))
);
const CounterSection = lazy(() =>
  import("./sections/CounterSection").then((m) => ({
    default: m.CounterSection,
  }))
);
const AdderSection = lazy(() =>
  import("./sections/AdderSection").then((m) => ({
    default: m.AdderSection,
  }))
);
const ALUSection = lazy(() =>
  import("./sections/ALUSection").then((m) => ({
    default: m.ALUSection,
  }))
);
const RAMSection = lazy(() =>
  import("./sections/RAMSection").then((m) => ({
    default: m.RAMSection,
  }))
);
const CPU6502Section = lazy(() =>
  import("./sections/CPU6502Section").then((m) => ({
    default: m.CPU6502Section,
  }))
);

export const metadata: Metadata = {
  title: "Building a CPU from Scratch | Turing Incomplete",
  description:
    "An interactive guide from NAND gates to a working 6502 CPU running C code. Every circuit is live — click switches, watch signals propagate, and build intuition for how computers work.",
  openGraph: {
    title: "Building a CPU from Scratch",
    description:
      "From NAND gates to a working 6502 — every circuit is live and interactive.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "Building a CPU from Scratch",
    description:
      "From NAND gates to a working 6502 — every circuit is live and interactive.",
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

export default function BuildingACPUPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <GatesSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CompositionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <MemorySection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CounterSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <AdderSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ALUSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RAMSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CPU6502Section />
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
            Every circuit on this page is simulated from NAND gates in your
            browser. No shortcuts, no abstractions, no cheating.
          </p>
        </footer>
      </main>
    </div>
  );
}
