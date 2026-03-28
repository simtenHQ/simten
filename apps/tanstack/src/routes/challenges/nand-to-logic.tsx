import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { NAND_LEVELS } from "@/features/challenges/nand-steps";
import { ChallengeWorkbench } from "@/features/challenges/components/ChallengeWorkbench";

const STORAGE_KEY = "ti:nand-to-logic:completed";

export const Route = createFileRoute("/challenges/nand-to-logic")({
  component: NandChallengePage,
});

function NandChallengePage() {
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
    const index = NAND_LEVELS.findIndex((s) => s.id === levelId);
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

  const nextLevelId =
    currentLevel < NAND_LEVELS.length - 1
      ? NAND_LEVELS[currentLevel + 1].id
      : null;

  return (
    <ChallengeWorkbench
      key={NAND_LEVELS[currentLevel].id}
      level={NAND_LEVELS[currentLevel]}
      challengeId="nand-to-logic"
      challengeTitle="From NAND to Logic"
      levelIndex={currentLevel}
      completedLevels={completedLevels}
      levels={NAND_LEVELS}
      onNavigate={handleNavigate}
      onLevelSelect={setCurrentLevel}
      nextLevelId={nextLevelId}
      onLevelComplete={handleLevelComplete}
    />
  );
}
