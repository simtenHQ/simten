/**
 * A sandbox in this process, for tests: a `SessionHost` behind a transport
 * that structured-clones every message, as postMessage would. No iframe, no
 * worker, no relay.
 */

import { SandboxClient, type SandboxTransport } from '@simten/sandbox';
import { SessionHost } from '@simten/sandbox/host';
import type { SandboxMessage, SessionRequest } from '@simten/sandbox/protocol';

/** `slowFirstCompile` holds the first compile's answer back 300ms. `sent` records every request. */
function inProcess({ slowFirstCompile = false } = {}): SandboxTransport & {
  sent: SessionRequest[];
} {
  let host: SessionHost | null = null;
  const sent: SessionRequest[] = [];
  let compiles = 0;
  return {
    sent,
    connect(receive) {
      host = new SessionHost({
        post: (message) => {
          if (message.type === 'progressed') return;
          const copy = structuredClone(message) as SandboxMessage;
          const slow = message.type === 'compiled' && compiles++ === 0 && slowFirstCompile;
          setTimeout(() => receive(copy), slow ? 300 : 0);
        },
      });
      setTimeout(() => receive({ type: 'ready' }), 0);
    },
    send(request) {
      sent.push(request);
      const copy = structuredClone(request);
      setTimeout(() => host?.handle(copy), 0);
    },
    close() {
      host = null;
    },
  };
}

/** A client on an in-process sandbox, and the transport, to read what was sent. */
export function inProcessClient(options?: { slowFirstCompile?: boolean }) {
  const transport = inProcess(options);
  return { client: new SandboxClient({ transport }), transport };
}
