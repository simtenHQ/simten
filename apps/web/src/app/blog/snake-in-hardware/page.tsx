import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "@/app/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const PixelsSection = lazy(() =>
  import("./sections/PixelsSection").then((m) => ({
    default: m.PixelsSection,
  }))
);
const AddressingSection = lazy(() =>
  import("./sections/AddressingSection").then((m) => ({
    default: m.AddressingSection,
  }))
);
const DirectionSection = lazy(() =>
  import("./sections/DirectionSection").then((m) => ({
    default: m.DirectionSection,
  }))
);
const MovementSection = lazy(() =>
  import("./sections/MovementSection").then((m) => ({
    default: m.MovementSection,
  }))
);
const PhaseSection = lazy(() =>
  import("./sections/PhaseSection").then((m) => ({
    default: m.PhaseSection,
  }))
);
const CollisionSection = lazy(() =>
  import("./sections/CollisionSection").then((m) => ({
    default: m.CollisionSection,
  }))
);
const SnakeSection = lazy(() =>
  import("./sections/SnakeSection").then((m) => ({
    default: m.SnakeSection,
  }))
);

export const metadata: Metadata = {
  title: "Snake in Hardware | Turing Incomplete",
  description:
    "A complete Snake game built entirely from logic gates, registers, and memory — no CPU, no software, just digital circuits. Every circuit is live and interactive.",
  openGraph: {
    title: "Snake in Hardware",
    description:
      "A hardware-only Snake game — no CPU, no software, just logic gates and memory.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "Snake in Hardware",
    description:
      "A hardware-only Snake game — no CPU, no software, just logic gates and memory.",
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

export default function SnakeInHardwarePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PixelsSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <AddressingSection />
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
              <MovementSection />
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
              <CollisionSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <SnakeSection />
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
            browser. No CPU, no software, no cheating.
          </p>
        </footer>
      </main>
    </div>
  );
}
