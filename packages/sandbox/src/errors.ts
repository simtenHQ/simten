/**
 * Why a sandbox call failed:
 *
 * - `failed`: the sandbox ran the request and it threw (a compile error, an
 *   unknown name, a `setInput` on something that isn't an input).
 * - `timed-out`: the worker went 5 seconds without a word while this request
 *   was the oldest one waiting, so the relay restarted it.
 * - `restarted`: the request was waiting when the worker was restarted for
 *   another one's sake. Retrying it is reasonable.
 * - `unavailable`: the sandbox iframe never loaded.
 * - `closed`: the session or the client was closed first.
 */
export type SandboxErrorCode = 'failed' | 'timed-out' | 'restarted' | 'unavailable' | 'closed';

/** What every `SandboxClient` and `SimulationClient` promise rejects with. */
export class SandboxError extends Error {
  readonly code: SandboxErrorCode;

  constructor(code: SandboxErrorCode, message: string) {
    super(message);
    this.name = 'SandboxError';
    this.code = code;
  }
}
