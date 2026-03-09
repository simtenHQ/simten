export type { ChallengeStage, ChallengeMetadata } from './types.js';
export { extractConnections, checkProgress, getNextMissingConnection, type ProgressResult } from './progress.js';

export { ALU_STAGES, ALU_METADATA } from './build-an-alu.js';
export { SNAKE_STAGES, SNAKE_METADATA } from './snake.js';

import type { ChallengeStage, ChallengeMetadata } from './types.js';
import { ALU_STAGES, ALU_METADATA } from './build-an-alu.js';
import { SNAKE_STAGES, SNAKE_METADATA } from './snake.js';

interface ChallengeEntry {
  metadata: ChallengeMetadata;
  stages: ChallengeStage[];
}

const CHALLENGES_MAP: Record<string, ChallengeEntry> = {
  'build-an-alu': { metadata: ALU_METADATA, stages: ALU_STAGES },
  'snake': { metadata: SNAKE_METADATA, stages: SNAKE_STAGES },
};

export const ALL_CHALLENGES: ChallengeMetadata[] = [
  ALU_METADATA,
  SNAKE_METADATA,
];

export function getChallengeStages(slug: string): ChallengeStage[] | undefined {
  return CHALLENGES_MAP[slug]?.stages;
}

export function getChallengeStage(slug: string, stageId: string): ChallengeStage | undefined {
  return CHALLENGES_MAP[slug]?.stages.find(s => s.id === stageId);
}

export function getChallengeMetadata(slug: string): ChallengeMetadata | undefined {
  return CHALLENGES_MAP[slug]?.metadata;
}
