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
  vcd: string;
  steadyStateAt?: number;
}

/** Browser's acknowledgment that it executed a pushed source (render round-trip). */
export interface RenderResult {
  ok: boolean;
  circuitName?: string | null;
  error?: string;
  /** True when the browser never replied within the timeout. */
  timedOut?: boolean;
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
