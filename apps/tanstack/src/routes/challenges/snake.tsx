import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from "react";
import { SNAKE_LEVELS } from "@/features/challenges/snake-steps";
import { ChallengeWorkbench } from "@/features/challenges/components/ChallengeWorkbench";

const STORAGE_KEY = "ti:snake:completed";

export const Route = createFileRoute('/challenges/snake')({
  component: SnakeChallengePage,
})

function SnakeChallengePage() {
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
    const index = SNAKE_LEVELS.findIndex((s) => s.id === levelId);
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

  const nextLevelId = currentLevel < SNAKE_LEVELS.length - 1
    ? SNAKE_LEVELS[currentLevel + 1].id
    : null;

  return (
    <ChallengeWorkbench
      key={SNAKE_LEVELS[currentLevel].id}
      level={SNAKE_LEVELS[currentLevel]}
      challengeId="snake"
      challengeTitle="Build Snake in Hardware"
      levelIndex={currentLevel}
      completedLevels={completedLevels}
      levels={SNAKE_LEVELS}
      onNavigate={handleNavigate}
      onLevelSelect={setCurrentLevel}
      nextLevelId={nextLevelId}
      onLevelComplete={handleLevelComplete}
    />
  );
}
