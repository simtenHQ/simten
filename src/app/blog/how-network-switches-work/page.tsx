import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { HeroSection } from "./sections/HeroSection";
import { ErrorBoundary } from "@/app/blog/building-a-cpu/ErrorBoundary";

// Lazy-load heavier sections so the page renders fast
const FrameSection = lazy(() =>
  import("./sections/FrameSection").then((m) => ({
    default: m.FrameSection,
  }))
);
const BufferSection = lazy(() =>
  import("./sections/BufferSection").then((m) => ({
    default: m.BufferSection,
  }))
);
const ArbiterSection = lazy(() =>
  import("./sections/ArbiterSection").then((m) => ({
    default: m.ArbiterSection,
  }))
);
const RouterSection = lazy(() =>
  import("./sections/RouterSection").then((m) => ({
    default: m.RouterSection,
  }))
);
const EgressSection = lazy(() =>
  import("./sections/EgressSection").then((m) => ({
    default: m.EgressSection,
  }))
);
const SwitchSection = lazy(() =>
  import("./sections/SwitchSection").then((m) => ({
    default: m.SwitchSection,
  }))
);

export const metadata: Metadata = {
  title: "How Network Switches Work | Turing Incomplete",
  description:
    "Build a 2-port Ethernet switch from logic gates: frame parsing, packet buffering, arbitration, crossbar routing, and egress serialization — all simulated in your browser.",
  openGraph: {
    title: "How Network Switches Work",
    description:
      "A hardware-level guide to packet switching — from frame detection to crossbar routing.",
    type: "article",
    siteName: "Turing Incomplete",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Network Switches Work",
    description:
      "A hardware-level guide to packet switching — from frame detection to crossbar routing.",
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

export default function HowNetworkSwitchesWorkPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <FrameSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BufferSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ArbiterSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RouterSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <EgressSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <SwitchSection />
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
            browser. No shortcuts, no abstractions.
          </p>
        </footer>
      </main>
    </div>
  );
}
