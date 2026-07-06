import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/features/blog/building-a-cpu/ErrorBoundary';
import { HeroSection } from '@/features/learn/adders/sections/HeroSection';
import { breadcrumbLd, pageHead } from '@/lib/seo';

const HalfAdderSection = lazy(() =>
  import('@/features/learn/adders/sections/HalfAdderSection').then((m) => ({
    default: m.HalfAdderSection,
  })),
);
const FullAdderSection = lazy(() =>
  import('@/features/learn/adders/sections/FullAdderSection').then((m) => ({
    default: m.FullAdderSection,
  })),
);
const RippleCarrySection = lazy(() =>
  import('@/features/learn/adders/sections/RippleCarrySection').then((m) => ({
    default: m.RippleCarrySection,
  })),
);
const DepthSection = lazy(() =>
  import('@/features/learn/adders/sections/DepthSection').then((m) => ({
    default: m.DepthSection,
  })),
);
const CarryLookaheadSection = lazy(() =>
  import('@/features/learn/adders/sections/CarryLookaheadSection').then((m) => ({
    default: m.CarryLookaheadSection,
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

function AddersPage() {
  return (
    <div className="bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <HalfAdderSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <FullAdderSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <RippleCarrySection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <DepthSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />

          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CarryLookaheadSection />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/learn/adders')({
  head: () => ({
    ...pageHead({
      title: 'How adders work (and why ripple-carry is slow)',
      description:
        'Adders are how digital circuits do addition. The naive design — chaining single-bit adders together — has a problem that gets worse as inputs widen. This is a concept-level walkthrough of why, with live editable circuits.',
      path: '/learn/adders',
    }),
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Learn', path: '/learn' },
        { name: 'Adders', path: '/learn/adders' },
      ]),
    ],
  }),
  component: AddersPage,
});
