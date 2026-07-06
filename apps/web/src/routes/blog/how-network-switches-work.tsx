import { createFileRoute } from '@tanstack/react-router';
import { blogPostHead } from '@/lib/seo';
import { getPost } from '@/features/blog/posts';
import { Suspense, lazy } from 'react';
import { HeroSection } from '@/features/blog/how-network-switches-work/sections/HeroSection';
import { BlogFooter } from '@/features/blog/BlogFooter';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';

// Lazy-load heavier sections so the page renders fast
const FrameSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/FrameSection').then((m) => ({
    default: m.FrameSection,
  })),
);
const BufferSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/BufferSection').then((m) => ({
    default: m.BufferSection,
  })),
);
const ArbiterSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/ArbiterSection').then((m) => ({
    default: m.ArbiterSection,
  })),
);
const RouterSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/RouterSection').then((m) => ({
    default: m.RouterSection,
  })),
);
const EgressSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/EgressSection').then((m) => ({
    default: m.EgressSection,
  })),
);
const SwitchSection = lazy(() =>
  import('@/features/blog/how-network-switches-work/sections/SwitchSection').then((m) => ({
    default: m.SwitchSection,
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

function HowNetworkSwitchesWorkPage() {
  return (
    <>
      <HeroSection />

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <FrameSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <BufferSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <ArbiterSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <RouterSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <EgressSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />

        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <SwitchSection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter slug="how-network-switches-work" />
    </>
  );
}

export const Route = createFileRoute('/blog/how-network-switches-work')({
  head: () => blogPostHead(getPost('how-network-switches-work')),
  component: HowNetworkSwitchesWorkPage,
});
