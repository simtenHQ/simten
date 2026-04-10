import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/rv32i-cpu/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const WhyRiscVSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/WhyRiscVSection").then((m) => ({
    default: m.WhyRiscVSection,
  }))
);
const PipelineSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/PipelineSection").then((m) => ({
    default: m.PipelineSection,
  }))
);
const ALUSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/ALUSection").then((m) => ({
    default: m.ALUSection,
  }))
);
const HazardsSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/HazardsSection").then((m) => ({
    default: m.HazardsSection,
  }))
);
const RunningCodeSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/RunningCodeSection").then((m) => ({
    default: m.RunningCodeSection,
  }))
);
const TryItSection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/TryItSection").then((m) => ({
    default: m.TryItSection,
  }))
);
const CTASection = lazy(() =>
  import("@/features/blog/rv32i-cpu/sections/CTASection").then((m) => ({
    default: m.CTASection,
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

function RV32ICPUPage() {
  return (
    <>
      <HeroSection />

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <WhyRiscVSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PipelineSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <ALUSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <HazardsSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <RunningCodeSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <TryItSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <CTASection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter
        slug="rv32i-cpu"
        tagline="Every circuit on this page is simulated in your browser. The CPU is real — compile C and watch it execute."
      />
    </>
  );
}

export const Route = createFileRoute("/blog/rv32i-cpu")({
  head: () => ({
    meta: [
      { title: "A RISC-V CPU That Runs C | Simten" },
      {
        name: "description",
        content:
          "A 5-stage pipelined RISC-V CPU running in your browser. Write C, compile it with GCC, and step through execution cycle by cycle.",
      },
    ],
  }),
  component: RV32ICPUPage,
});
