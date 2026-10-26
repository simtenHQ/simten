import type { Circuit } from '@simten/core/circuit';

export interface BlogCircuit {
  name: string;
  description: string;
  circuit: Circuit;
  layout?: Record<string, { x: number; y: number }>;
}
