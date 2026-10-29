/**
 * `@simten/sandbox/host`: the sandbox's side. The session host runs in the
 * worker and the relay in the iframe's main thread; `inProcessSandbox()` wires
 * a client to a host in this process, for tests. Pages use the clients in
 * `@simten/sandbox` instead.
 */

export { type InProcessSandboxOptions, inProcessSandbox } from './in-process.js';
export { createRelay, type Relay, type RelayOptions, type RelayWorker } from './relay.js';
export { type HostClock, SessionHost, type SessionHostOptions } from './session-host.js';
