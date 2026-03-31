import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/aes-in-hardware/sections/HeroSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const SubBytesSection = lazy(() =>
  import("@/features/blog/aes-in-hardware/sections/SubBytesSection").then((m) => ({ default: m.SubBytesSection }))
);
const XTimeSection = lazy(() =>
  import("@/features/blog/aes-in-hardware/sections/XTimeSection").then((m) => ({ default: m.XTimeSection }))
);
const MixColumnsSection = lazy(() =>
  import("@/features/blog/aes-in-hardware/sections/MixColumnsSection").then((m) => ({ default: m.MixColumnsSection }))
);
const WhyHardwareSection = lazy(() =>
  import("@/features/blog/aes-in-hardware/sections/WhyHardwareSection").then((m) => ({ default: m.WhyHardwareSection }))
);

export const Route = createFileRoute('/blog/aes-in-hardware')({
  head: () => ({
    meta: [
      { title: 'AES in Hardware | Turing Incomplete' },
      { name: 'description', content: 'Why Intel built AES into the CPU. SubBytes, XTime, and MixColumns — the three operations behind the world\'s most deployed cipher, built from logic gates.' },
    ],
  }),
  component: AESInHardwarePage,
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

function AESInHardwarePage() {
  return (
    <>

        <HeroSection />

        <div className="space-y-4">
          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <SubBytesSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <XTimeSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <MixColumnsSection />
            </Suspense>
          </ErrorBoundary>

          <hr className="border-gray-200 dark:border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <WhyHardwareSection />
            </Suspense>
          </ErrorBoundary>
        </div>

        <BlogFooter slug="aes-in-hardware" />
    </>
  )
}
