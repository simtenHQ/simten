import type { Circuit } from '@simten/core';

export interface BlogCircuit {
  name: string;
  description: string;
  circuit: Circuit;
  layout?: Record<string, { x: number; y: number }>;
}
