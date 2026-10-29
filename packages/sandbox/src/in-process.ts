/**
 * `inProcessSandbox()`: a `SandboxClient` whose sandbox runs in this process,
 * for tests. A `SessionHost` answers it through a transport that
 * structured-clones every message and delivers it on a later task, as
 * postMessage does. There is no iframe, worker or watchdog, so user code runs
 * in the test's own process: use it for circuits you trust.
 *
 * ```tsx
 * const client = inProcessSandbox();
 * render(
 *   <SandboxProvider client={client}>
 *     <Demo />
 *   </SandboxProvider>,
 * );
 * // …
 * client.dispose();
 * ```
 */

import type { SandboxMessage, SessionRequest } from './protocol.js';
import { SandboxClient, type SandboxTransport } from './sandbox-client.js';
import { SessionHost, type SessionHostOptions } from './session-host.js';

export interface InProcessSandboxOptions {
  /** Run circuit source. Defaults to core's `executeCircuitCode`, as in the sandbox worker. */
  execute?: SessionHostOptions['execute'];
}

/** A sandbox client wired to a session host in this process. `dispose()` it when done. */
export function inProcessSandbox(options: InProcessSandboxOptions = {}): SandboxClient {
  let host: SessionHost | null = null;
  const transport: SandboxTransport = {
    connect(receive) {
      host = new SessionHost({
        execute: options.execute,
        post: (message) => {
          // The relay keeps heartbeats to itself.
          if (message.type === 'progressed') return;
          const copy = structuredClone(message) as SandboxMessage;
          setTimeout(() => receive(copy), 0);
        },
      });
      setTimeout(() => receive({ type: 'ready' }), 0);
    },
    send(request: SessionRequest) {
      const copy = structuredClone(request);
      setTimeout(() => host?.handle(copy), 0);
    },
    close() {
      host = null;
    },
  };
  return new SandboxClient({ transport });
}
