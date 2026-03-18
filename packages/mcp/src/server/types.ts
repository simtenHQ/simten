export interface CircuitState {
  cycleCount: number;
  inputs: Record<string, boolean | number>;
  outputs: Record<string, boolean | number>;
  isSequential: boolean;
  circuitName: string | null;
  timestamp: number;
}

export interface TracesPayload {
  circuit: string;
  ticks: number;
  inputs: string[];
  outputs: string[];
  signals: Record<string, Array<{ value: boolean | number; count: number }>>;
  steadyStateAt?: number;
}

export interface ChallengeState {
  challengeId: string;
  levelId: string;
  userSource: string;
  timestamp: number;
}

export interface TestResultsPayload {
  results: Array<{
    name: string;
    dutName?: string;
    status: 'passed' | 'failed';
    cycles: number;
    failureReason?: string;
    assertionSummary?: {
      total: number;
      passed: number;
      failed: number;
      results: Array<{ cycle: number; passed: boolean; message: string }>;
    };
  }>;
}
