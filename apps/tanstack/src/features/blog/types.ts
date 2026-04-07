import type { BuiltCircuit } from "@turing-incomplete/core/circuit";

export interface BlogCircuit {
  name: string;
  description: string;
  circuit: BuiltCircuit;
  nodePositions?: Record<string, { x: number; y: number }>;
}
