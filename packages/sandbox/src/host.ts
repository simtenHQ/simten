/**
 * `@simten/sandbox/host`: the sandbox's side. The session host runs in the
 * worker and the relay in the iframe's main thread. Pages use the clients in
 * `@simten/sandbox` instead.
 */

export { createRelay, type Relay, type RelayOptions, type RelayWorker } from './relay.js';
export { type HostClock, SessionHost, type SessionHostOptions } from './session-host.js';
