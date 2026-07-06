import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { BlogFooter } from '@/features/blog/BlogFooter';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';
import { HeroSection } from '@/features/blog/pong-in-hardware/sections/HeroSection';
import { getPost } from '@/features/blog/posts';
import { blogPostHead } from '@/lib/seo';

const BallSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/BallSection').then((m) => ({
    default: m.BallSection,
  })),
);
const BounceSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/BounceSection').then((m) => ({
    default: m.BounceSection,
  })),
);
const PaddleSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/PaddleSection').then((m) => ({
    default: m.PaddleSection,
  })),
);
const PhaseSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/PhaseSection').then((m) => ({
    default: m.PhaseSection,
  })),
);
const AddressSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/AddressSection').then((m) => ({
    default: m.AddressSection,
  })),
);
const PongSection = lazy(() =>
  import('@/features/blog/pong-in-hardware/sections/PongSection').then((m) => ({
    default: m.PongSection,
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

function PongInHardwarePage() {
  return (
    <>
      <HeroSection />

      <ErrorBoundary>
        <Suspense fallback={<SectionSkeleton />}>
          <PongSection />
        </Suspense>
      </ErrorBoundary>

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <BallSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <BounceSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PaddleSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PhaseSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <AddressSection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter slug="pong-in-hardware" />
    </>
  );
}

export const Route = createFileRoute('/blog/pong-in-hardware')({
  head: () => blogPostHead(getPost('pong-in-hardware')),
  component: PongInHardwarePage,
});
