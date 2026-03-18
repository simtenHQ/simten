import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from "react";
import { CPU_LEVELS } from "@/features/challenges/cpu-steps";
import { ChallengeWorkbench } from "@/features/challenges/components/ChallengeWorkbench";

const STORAGE_KEY = "ti:build-a-cpu:completed";

export const Route = createFileRoute('/challenges/build-a-cpu')({
  component: CPUChallengePage,
})

function CPUChallengePage() {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedLevels, setCompletedLevels] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCompletedLevels(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      if (completedLevels.size > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedLevels]));
      }
    } catch { /* ignore */ }
  }, [completedLevels]);

  const handleNavigate = useCallback((levelId: string) => {
    const index = CPU_LEVELS.findIndex((s) => s.id === levelId);
    if (index >= 0) setCurrentLevel(index);
  }, []);

  const handleLevelComplete = useCallback((levelId: string) => {
    setCompletedLevels((prev) => {
      if (prev.has(levelId)) return prev;
      const next = new Set(prev);
      next.add(levelId);
      return next;
    });
  }, []);

  const nextLevelId = currentLevel < CPU_LEVELS.length - 1
    ? CPU_LEVELS[currentLevel + 1].id
    : null;

  return (
    <ChallengeWorkbench
      key={CPU_LEVELS[currentLevel].id}
      level={CPU_LEVELS[currentLevel]}
      challengeId="build-a-cpu"
      challengeTitle="Build a CPU That Runs C"
      levelIndex={currentLevel}
      completedLevels={completedLevels}
      levels={CPU_LEVELS}
      onNavigate={handleNavigate}
      onLevelSelect={setCurrentLevel}
      nextLevelId={nextLevelId}
      onLevelComplete={handleLevelComplete}
    />
  );
}
