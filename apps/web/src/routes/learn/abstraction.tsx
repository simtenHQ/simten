import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';
import { HeroSection } from '@/features/learn/abstraction/sections/HeroSection';
import { breadcrumbLd, pageHead } from '@/lib/seo';

const TwoWaysSection = lazy(() =>
  import('@/features/learn/abstraction/sections/TwoWaysSection').then((m) => ({
    default: m.TwoWaysSection,
  })),
);
const BuildingUpSection = lazy(() =>
  import('@/features/learn/abstraction/sections/BuildingUpSection').then((m) => ({
    default: m.BuildingUpSection,
  })),
);
const ScalingSection = lazy(() =>
  import('@/features/learn/abstraction/sections/ScalingSection').then((m) => ({
    default: m.ScalingSection,
  })),
);
const WhenToEncapsulateSection = lazy(() =>
  import('@/features/learn/abstraction/sections/WhenToEncapsulateSection').then((m) => ({
    default: m.WhenToEncapsulateSection,
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

function AbstractionPage() {
  return (
    <div className="bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <TwoWaysSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BuildingUpSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ScalingSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <WhenToEncapsulateSection />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/learn/abstraction')({
  head: () => ({
    ...pageHead({
      title: 'Abstraction in circuit design',
      description:
        'How a cluster of gates becomes a named block you can reuse, and how the same move scales from a half-adder up to a CPU. Why nobody designs chips by drawing individual gates.',
      path: '/learn/abstraction',
    }),
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Learn', path: '/learn' },
        { name: 'Abstraction', path: '/learn/abstraction' },
      ]),
    ],
  }),
  component: AbstractionPage,
});
