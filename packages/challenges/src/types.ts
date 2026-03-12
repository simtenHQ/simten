export interface ChallengeStage {
  id: string;
  title: string;
  concept: string;
  objective: string;
  hints: string[];
  scaffold: string;
  solution: string;
  nodePositions?: Record<string, { x: number; y: number }>;
  height?: number;
  /** Restrict palette to these namespaces (e.g., ['core', 'rv32i']) */
  allowedNamespaces?: string[];
  /** Restrict palette to these specific primitives (e.g., ['And', 'Or', 'Not']) */
  allowedPrimitives?: string[];
  checks?: Array<{
    description: string;
    /** Node label whose output to check */
    node: string;
    /** Port name to read */
    port: string;
    /** Expected value after setup */
    expected: number;
    /** Inputs to set before checking: [nodeLabel, value][] */
    inputs?: [string, number][];
    /** Number of ticks to run before checking */
    ticks?: number;
  }>;
}

export interface ChallengeMetadata {
  slug: string;
  title: string;
  description: string;
  stages: number;
  difficulty: string;
  tag?: string;
}
