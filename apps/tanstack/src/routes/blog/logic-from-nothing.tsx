import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, Suspense, lazy } from "react";
import { HeroSection } from "@/features/blog/logic-from-nothing/sections/HeroSection";
import { NandSection } from "@/features/blog/logic-from-nothing/sections/NandSection";
import { BlogFooter } from "@/features/blog/BlogFooter";
import { ErrorBoundary } from "@/features/blog/building-a-cpu/ErrorBoundary";

const NotChallengeSection = lazy(() =>
  import("@/features/blog/logic-from-nothing/sections/NotChallengeSection").then((m) => ({ default: m.NotChallengeSection }))
);
const AndChallengeSection = lazy(() =>
  import("@/features/blog/logic-from-nothing/sections/AndChallengeSection").then((m) => ({ default: m.AndChallengeSection }))
);
const OrChallengeSection = lazy(() =>
  import("@/features/blog/logic-from-nothing/sections/OrChallengeSection").then((m) => ({ default: m.OrChallengeSection }))
);
const XorChallengeSection = lazy(() =>
  import("@/features/blog/logic-from-nothing/sections/XorChallengeSection").then((m) => ({ default: m.XorChallengeSection }))
);

export const Route = createFileRoute('/blog/logic-from-nothing')({
  head: () => ({
    meta: [
      { title: 'Logic from Nothing | Turing Incomplete' },
      { name: 'description', content: 'Build NOT, AND, OR, and XOR from nothing but NAND gates. An interactive article where you write real circuits and prove they work.' },
    ],
  }),
  component: LogicFromNothingPage,
})

function SectionSkeleton() {
  return (
    <div className="py-12 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-64 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-800/50 rounded w-full" />
        <div className="h-4 bg-gray-800/50 rounded w-5/6" />
      </div>
    </div>
  );
}

function LockedSection({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900/50 border border-gray-800/50">
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    </div>
  );
}

function LogicFromNothingPage() {
  const [notPassed, setNotPassed] = useState(false);
  const [andPassed, setAndPassed] = useState(false);
  const [orPassed, setOrPassed] = useState(false);

  const handleNotPass = useCallback(() => setNotPassed(true), []);
  const handleAndPass = useCallback(() => setAndPassed(true), []);
  const handleOrPass = useCallback(() => setOrPassed(true), []);

  return (
    <>

        <HeroSection />

        <div className="space-y-4">
          {/* NAND intro — always visible */}
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <NandSection />
          </ErrorBoundary>

          {/* Challenge 1: NOT */}
          <hr className="border-gray-800" />
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <NotChallengeSection onPass={handleNotPass} />
            </Suspense>
          </ErrorBoundary>

          {/* Challenge 2: AND — unlocks after NOT */}
          <hr className="border-gray-800" />
          {notPassed ? (
            <ErrorBoundary>
              <Suspense fallback={<SectionSkeleton />}>
                <AndChallengeSection onPass={handleAndPass} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <LockedSection label="Pass Challenge 1 to unlock AND" />
          )}

          {/* Challenge 3: OR — unlocks after AND */}
          <hr className="border-gray-800" />
          {andPassed ? (
            <ErrorBoundary>
              <Suspense fallback={<SectionSkeleton />}>
                <OrChallengeSection onPass={handleOrPass} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <LockedSection label="Pass Challenge 2 to unlock OR" />
          )}

          {/* Challenge 4: XOR — unlocks after OR */}
          <hr className="border-gray-800" />
          {orPassed ? (
            <ErrorBoundary>
              <Suspense fallback={<SectionSkeleton />}>
                <XorChallengeSection />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <LockedSection label="Pass Challenge 3 to unlock XOR" />
          )}
        </div>

        <BlogFooter slug="logic-from-nothing" />
    </>
  )
}
