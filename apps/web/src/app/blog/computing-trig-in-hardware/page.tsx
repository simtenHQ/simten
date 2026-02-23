import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "@/app/blog/building-a-cpu/ErrorBoundary";

const ShiftSection = lazy(() =>
  import("./sections/ShiftSection").then((m) => ({
    default: m.ShiftSection,
  }))
);
const RotationSection = lazy(() =>
  import("./sections/RotationSection").then((m) => ({
    default: m.RotationSection,
  }))
);
const DirectionSection = lazy(() =>
  import("./sections/DirectionSection").then((m) => ({
    default: m.DirectionSection,
  }))
);
const IterationSection = lazy(() =>
  import("./sections/IterationSection").then((m) => ({
    default: m.IterationSection,
  }))
);
const LookupSection = lazy(() =>
  import("./sections/LookupSection").then((m) => ({
    default: m.LookupSection,
  }))
);
const CORDICSection = lazy(() =>
  import("./sections/CORDICSection").then((m) => ({
    default: m.CORDICSection,
  }))
);

export const metadata: Metadata = {
  title: "Computing Trig in Hardware | Turing Incomplete",
  description:
    "How calculators and GPUs compute sine and cosine using only bit shifts and addition — the CORDIC algorithm, built from logic gates in your browser.",
  openGraph: {
    title: "Computing Trig in Hardware",
    description:
      "The CORDIC algorithm — sine and cosine from shifts and adds, no multiplier needed.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "Computing Trig in Hardware",
    description:
      "The CORDIC algorithm — sine and cosine from shifts and adds, no multiplier needed.",
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

export default function ComputingTrigPage() {
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
