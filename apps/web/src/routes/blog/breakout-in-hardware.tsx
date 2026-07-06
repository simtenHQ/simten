import { createFileRoute } from '@tanstack/react-router';
import { blogPostHead } from '@/lib/seo';
import { getPost } from '@/features/blog/posts';
import { Suspense, lazy } from 'react';
import { HeroSection } from '@/features/blog/breakout-in-hardware/sections/HeroSection';
import { BlogFooter } from '@/features/blog/BlogFooter';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';

const PaddleSection = lazy(() =>
  import('@/features/blog/breakout-in-hardware/sections/PaddleSection').then((m) => ({
    default: m.PaddleSection,
  })),
);
const BallSection = lazy(() =>
  import('@/features/blog/breakout-in-hardware/sections/BallSection').then((m) => ({
    default: m.BallSection,
  })),
);
const BricksSection = lazy(() =>
  import('@/features/blog/breakout-in-hardware/sections/BricksSection').then((m) => ({
    default: m.BricksSection,
  })),
);
const PipelineSection = lazy(() =>
  import('@/features/blog/breakout-in-hardware/sections/PipelineSection').then((m) => ({
    default: m.PipelineSection,
  })),
);
const BreakoutSection = lazy(() =>
  import('@/features/blog/breakout-in-hardware/sections/BreakoutSection').then((m) => ({
    default: m.BreakoutSection,
  })),
);

export const Route = createFileRoute('/blog/breakout-in-hardware')({
  head: () => blogPostHead(getPost('breakout-in-hardware')),
  component: BreakoutInHardwarePage,
});

function SectionSkeleton() {
  return (
    <div className="py-12 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-full" />
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-5/6" />
        <div className="h-4 bg-gray-200/50 dark:bg-gray-800/50 rounded w-4/6" />
      </div>
    </div>
  );
}

function BreakoutInHardwarePage() {
  return (
    <>
      <HeroSection />

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PaddleSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <BallSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <BricksSection />
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
            <BreakoutSection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter slug="breakout-in-hardware" />
    </>
  );
}
