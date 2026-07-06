import type { BuiltCircuit } from '@simten/core/circuit';

export interface BlogCircuit {
  name: string;
  description: string;
  circuit: BuiltCircuit;
  layout?: Record<string, { x: number; y: number }>;
}
