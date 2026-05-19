import { createFileRoute } from "@tanstack/react-router";
import { pageHead, breadcrumbLd } from "@/lib/seo";
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/learn/registers/sections/HeroSection";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const DFlipFlopSection = lazy(() =>
  import("@/features/learn/registers/sections/DFlipFlopSection").then((m) => ({
    default: m.DFlipFlopSection,
  })),
);
const RegisterSection = lazy(() =>
  import("@/features/learn/registers/sections/RegisterSection").then((m) => ({
    default: m.RegisterSection,
  })),
);
const CounterSection = lazy(() =>
  import("@/features/learn/registers/sections/CounterSection").then((m) => ({
    default: m.CounterSection,
  })),
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

function RegistersPage() {
  return (
    <div className="bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <DFlipFlopSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RegisterSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CounterSection />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/learn/registers")({
  head: () => ({
    ...pageHead({
      title: "How registers work",
      description:
        "How circuits remember. From the single-bit D flip-flop to multi-bit registers with write-enable, ending with a counter — the first useful sequential circuit.",
      path: "/learn/registers",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Learn", path: "/learn" },
        { name: "Registers", path: "/learn/registers" },
      ]),
    ],
  }),
  component: RegistersPage,
});
