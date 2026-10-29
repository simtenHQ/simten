/**
 * `@simten/sandbox`: run circuits in a cross-origin sandbox from a page, with
 * no React. `SandboxClient` is one sandbox (a hidden iframe); its `open`
 * returns a `SimulationClient`, an async mirror of core's `Simulation`.
 *
 * ```ts
 * const sandbox = new SandboxClient();
 * const compiled = await sandbox.compile(source);
 * const sim = await sandbox.open({ compiled, circuit: 'Counter' });
 * await sim.tick(10);
 * sim.get('count');
 * ```
 *
 * The sandbox's own side (the worker's session host and the iframe's relay)
 * is in `@simten/sandbox/host`, with `inProcessSandbox()` for tests. The
 * messages between them are internal.
 */

export { SandboxError, type SandboxErrorCode } from './errors.js';
export type { CompileId, SessionId, SessionUpdate } from './protocol.js';
export {
  type Compiled,
  iframeTransport,
  type OpenOptions,
  portTransport,
  SandboxClient,
  type SandboxClientOptions,
  type SandboxStatus,
  type SandboxTransport,
  type SessionSource,
} from './sandbox-client.js';
export { SimulationClient, type SimulationClientState } from './simulation-client.js';
