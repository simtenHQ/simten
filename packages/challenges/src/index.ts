export type { ChallengeStep, ChallengeMetadata } from './types.js';
export { extractConnections, checkProgress, type ProgressResult } from './progress.js';

export { ALU_STEPS, ALU_METADATA } from './build-an-alu.js';
export { SNAKE_STEPS, SNAKE_METADATA } from './snake.js';

import type { ChallengeStep, ChallengeMetadata } from './types.js';
import { ALU_STEPS, ALU_METADATA } from './build-an-alu.js';
import { SNAKE_STEPS, SNAKE_METADATA } from './snake.js';

interface ChallengeEntry {
  metadata: ChallengeMetadata;
  steps: ChallengeStep[];
}

const CHALLENGES_MAP: Record<string, ChallengeEntry> = {
  'build-an-alu': { metadata: ALU_METADATA, steps: ALU_STEPS },
  'snake': { metadata: SNAKE_METADATA, steps: SNAKE_STEPS },
};

export const ALL_CHALLENGES: ChallengeMetadata[] = [
  ALU_METADATA,
  SNAKE_METADATA,
];

export function getChallengeSteps(slug: string): ChallengeStep[] | undefined {
  return CHALLENGES_MAP[slug]?.steps;
}

export function getChallengeStep(slug: string, stepId: string): ChallengeStep | undefined {
  return CHALLENGES_MAP[slug]?.steps.find(s => s.id === stepId);
}

export function getChallengeMetadata(slug: string): ChallengeMetadata | undefined {
  return CHALLENGES_MAP[slug]?.metadata;
}
