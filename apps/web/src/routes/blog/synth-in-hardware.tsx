import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { BlogFooter } from '@/features/blog/BlogFooter';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';
import { getPost } from '@/features/blog/posts';
import { HeroSection } from '@/features/blog/synth-in-hardware/sections/HeroSection';
import { blogPostHead } from '@/lib/seo';

const PlayerSection = lazy(() =>
  import('@/features/blog/synth-in-hardware/sections/PlayerSection').then((m) => ({
    default: m.PlayerSection,
  })),
);
const CircuitSection = lazy(() =>
  import('@/features/blog/synth-in-hardware/sections/CircuitSection').then((m) => ({
    default: m.CircuitSection,
  })),
);

export const Route = createFileRoute('/blog/synth-in-hardware')({
  head: () => blogPostHead(getPost('synth-in-hardware')),
  component: SynthInHardwarePage,
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

function SynthInHardwarePage() {
  return (
    <>
      <HeroSection />

      <div className="space-y-4">
        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <PlayerSection />
          </Suspense>
        </ErrorBoundary>

        <hr className="border-gray-200 dark:border-gray-800" />
        <ErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <CircuitSection />
          </Suspense>
        </ErrorBoundary>
      </div>

      <BlogFooter slug="synth-in-hardware" />
    </>
  );
}
