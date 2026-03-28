export type { ChallengeLevel, ChallengeMetadata } from './types.js';
export { extractConnections, checkProgress, getNextMissingConnection, type ProgressResult } from './progress.js';

export { ALU_LEVELS, ALU_METADATA } from './build-an-alu.js';
export { SNAKE_LEVELS, SNAKE_METADATA } from './snake.js';
export { CPU_LEVELS, CPU_METADATA } from './build-a-cpu.js';
export { NAND_LEVELS, NAND_METADATA } from './nand-to-logic.js';

import type { ChallengeLevel, ChallengeMetadata } from './types.js';
import { ALU_LEVELS, ALU_METADATA } from './build-an-alu.js';
import { SNAKE_LEVELS, SNAKE_METADATA } from './snake.js';
import { CPU_LEVELS, CPU_METADATA } from './build-a-cpu.js';
import { NAND_LEVELS, NAND_METADATA } from './nand-to-logic.js';

interface ChallengeEntry {
  metadata: ChallengeMetadata;
  levels: ChallengeLevel[];
}

const CHALLENGES_MAP: Record<string, ChallengeEntry> = {
  'nand-to-logic': { metadata: NAND_METADATA, levels: NAND_LEVELS },
  'build-an-alu': { metadata: ALU_METADATA, levels: ALU_LEVELS },
  'snake': { metadata: SNAKE_METADATA, levels: SNAKE_LEVELS },
  'build-a-cpu': { metadata: CPU_METADATA, levels: CPU_LEVELS },
};

export const ALL_CHALLENGES: ChallengeMetadata[] = [
  NAND_METADATA,
  ALU_METADATA,
  SNAKE_METADATA,
  CPU_METADATA,
];

export function getChallengeLevels(slug: string): ChallengeLevel[] | undefined {
  return CHALLENGES_MAP[slug]?.levels;
}

export function getChallengeLevel(slug: string, levelId: string): ChallengeLevel | undefined {
  return CHALLENGES_MAP[slug]?.levels.find(l => l.id === levelId);
}

export function getChallengeMetadata(slug: string): ChallengeMetadata | undefined {
  return CHALLENGES_MAP[slug]?.metadata;
}
