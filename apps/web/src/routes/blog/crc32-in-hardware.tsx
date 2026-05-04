import { createFileRoute } from '@tanstack/react-router'
import { blogPostHead } from '@/lib/seo'
import { getPost } from '@/features/blog/posts'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/crc32-in-hardware/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const LFSRSection = lazy(() =>
  import("@/features/blog/crc32-in-hardware/sections/LFSRSection").then((m) => ({ default: m.LFSRSection }))
);
const PolynomialSection = lazy(() =>
  import("@/features/blog/crc32-in-hardware/sections/PolynomialSection").then((m) => ({ default: m.PolynomialSection }))
);
const CRC32Section = lazy(() =>
  import("@/features/blog/crc32-in-hardware/sections/CRC32Section").then((m) => ({ default: m.CRC32Section }))
);
const VerifySection = lazy(() =>
  import("@/features/blog/crc32-in-hardware/sections/VerifySection").then((m) => ({ default: m.VerifySection }))
);

export const Route = createFileRoute('/blog/crc32-in-hardware')({
  head: () => blogPostHead(getPost('crc32-in-hardware')),
  component: CRC32InHardwarePage,
})

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

function CRC32InHardwarePage() {
  return (
    <>

        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <LFSRSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <PolynomialSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CRC32Section />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <VerifySection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="crc32-in-hardware" />
    </>
  )
}
