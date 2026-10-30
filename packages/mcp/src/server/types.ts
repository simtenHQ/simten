/** A circuit pushed to the canvas, with how its run starts. */
export interface SourcePush {
  source: string;
  /** Memory contents loaded before cycle 0, by exact node path. */
  memory?: Record<string, Record<string, number>>;
  /** Input values at cycle 0: input port names and Switch or Input node paths. */
  inputs?: Record<string, number>;
}

/** Browser's acknowledgment that it executed a pushed source (render round-trip). */
export interface RenderResult {
  ok: boolean;
  circuitName?: string | null;
  error?: string;
  /** True when the browser never replied within the timeout. */
  timedOut?: boolean;
}
