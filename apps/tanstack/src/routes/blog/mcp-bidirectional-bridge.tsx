import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/mcp-bidirectional-bridge/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const ProblemSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/ProblemSection").then((m) => ({ default: m.ProblemSection }))
);
const ArchitectureSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/ArchitectureSection").then((m) => ({ default: m.ArchitectureSection }))
);
const ChannelSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/ChannelSection").then((m) => ({ default: m.ChannelSection }))
);
const StateSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/StateSection").then((m) => ({ default: m.StateSection }))
);
const CostSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/CostSection").then((m) => ({ default: m.CostSection }))
);
const FutureSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/FutureSection").then((m) => ({ default: m.FutureSection }))
);
const LiveDemoSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/LiveDemoSection").then((m) => ({ default: m.LiveDemoSection }))
);
const PatternSection = lazy(() =>
  import("@/features/blog/mcp-bidirectional-bridge/sections/PatternSection").then((m) => ({ default: m.PatternSection }))
);

export const Route = createFileRoute('/blog/mcp-bidirectional-bridge')({
  head: () => ({
    meta: [
      { title: 'MCP as a Real-Time Bridge Between AI Agents and Web Apps | Turing Incomplete' },
      { name: 'description', content: 'How to use MCP as a bidirectional nervous system between an AI agent and a live web application — with zero AI API costs.' },
    ],
  }),
  component: MCPBridgePage,
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
    </div>
  );
}

function MCPBridgePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ProblemSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ArchitectureSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <LiveDemoSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ChannelSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <StateSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CostSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <FutureSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PatternSection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="mcp-bidirectional-bridge" />
      </main>
    </div>
  )
}
