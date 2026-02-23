import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "@/app/blog/building-a-cpu/ErrorBoundary";

const BallSection = lazy(() =>
  import("./sections/BallSection").then((m) => ({ default: m.BallSection }))
);
const BounceSection = lazy(() =>
  import("./sections/BounceSection").then((m) => ({ default: m.BounceSection }))
);
const PaddleSection = lazy(() =>
  import("./sections/PaddleSection").then((m) => ({ default: m.PaddleSection }))
);
const PhaseSection = lazy(() =>
  import("./sections/PhaseSection").then((m) => ({ default: m.PhaseSection }))
);
const AddressSection = lazy(() =>
  import("./sections/AddressSection").then((m) => ({ default: m.AddressSection }))
);
const PongSection = lazy(() =>
  import("./sections/PongSection").then((m) => ({ default: m.PongSection }))
);

export const metadata: Metadata = {
  title: "Pong in Hardware | Turing Incomplete",
  description:
    "A complete Pong game built from logic gates, registers, and memory — two paddles, a bouncing ball, and a 6-phase rendering pipeline, all without a CPU.",
  openGraph: {
    title: "Pong in Hardware",
    description:
      "Two-player Pong — no CPU, no software, just logic gates and memory.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pong in Hardware",
    description:
      "Two-player Pong — no CPU, no software, just logic gates and memory.",
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

export default function PongInHardwarePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BallSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BounceSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PaddleSection />
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
              <AddressSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PongSection />
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
