import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from "react";
import { SNAKE_STAGES } from "@/features/challenges/snake-steps";
import { ChallengeWorkbench } from "@/features/challenges/components/ChallengeWorkbench";

const STORAGE_KEY = "ti:snake:completed";

export const Route = createFileRoute('/challenges/snake')({
  component: SnakeChallengePage,
})

function SnakeChallengePage() {
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const stage = SNAKE_STAGES[currentStage];

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCompletedStages(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Persist completed stages
  useEffect(() => {
    try {
      if (completedStages.size > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedStages]));
      }
    } catch { /* ignore */ }
  }, [completedStages]);

  const handleNavigate = useCallback((stageId: string) => {
    const index = SNAKE_STAGES.findIndex((s) => s.id === stageId);
    if (index >= 0) setCurrentStage(index);
  }, []);

  const handleStageComplete = useCallback((stageId: string) => {
    setCompletedStages((prev) => {
      if (prev.has(stageId)) return prev;
      const next = new Set(prev);
      next.add(stageId);
      return next;
    });
  }, []);

  const nextStageId = currentStage < SNAKE_STAGES.length - 1
    ? SNAKE_STAGES[currentStage + 1].id
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <section className="py-12 md:py-16">
          <div className="max-w-3xl">
            <a
              href="/challenges"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← All Challenges
            </a>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Build Snake in Hardware
            </h1>
            <p className="mt-4 text-lg text-gray-400 leading-relaxed">
              Wire up a complete Snake game from scratch — no CPU, no software,
              just logic gates, registers, and RAM. Each stage introduces a new
              concept and asks you to connect the circuit yourself.
            </p>
          </div>
        </section>

        {/* Stage navigation */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {SNAKE_STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentStage(i)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                i === currentStage
                  ? "bg-blue-600 text-white"
                  : completedStages.has(s.id)
                  ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
              }`}
            >
              <span className="text-xs opacity-60 mr-1.5">
                {completedStages.has(s.id) ? "✓" : i + 1}
              </span>
              {s.title}
            </button>
          ))}
        </div>

        {/* Current stage */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Stage {currentStage + 1}: {stage.title}
            </h2>
            <p className="text-gray-300 leading-relaxed max-w-3xl">
              {stage.concept}
            </p>
          </div>

          <ChallengeWorkbench
            key={stage.id}
            stage={stage}
            challengeId="snake"
            onNavigate={handleNavigate}
            nextStageId={nextStageId}
            onStageComplete={handleStageComplete}
          />

          {/* Stage navigation footer */}
          <div className="flex justify-between pt-8 border-t border-gray-800">
            <button
              onClick={() => setCurrentStage((s) => Math.max(0, s - 1))}
              disabled={currentStage === 0}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() =>
                setCurrentStage((s) =>
                  Math.min(SNAKE_STAGES.length - 1, s + 1)
                )
              }
              disabled={currentStage === SNAKE_STAGES.length - 1}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next Stage →
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Turing Incomplete
          </a>
        </footer>
      </main>
    </div>
  );
}
