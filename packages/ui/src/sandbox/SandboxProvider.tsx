/**
 * SandboxProvider: one sandbox for everything under it.
 *
 * It holds one `SandboxClient` (one hidden iframe), which `useSimulation` and
 * `useSandboxClient` use. The client is created when the first of them mounts,
 * so a page with no circuits loads no sandbox.
 *
 * It also holds the old slot sandbox for `useSandboxContext`, which nothing in
 * the apps calls any more; #417 PR 8 deletes it. Its iframe only loads on a first
 * request, so with no callers it never does.
 */

import { SandboxClient } from '@simten/sandbox';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type SandboxHandle, useSandbox } from './useSandbox.js';

interface SharedClient {
  /** Null until something has asked for it, and on the server. */
  client: SandboxClient | null;
  /** Create the client if nobody has yet. */
  want(): void;
}

const SandboxContext = createContext<SandboxHandle | null>(null);
const ClientContext = createContext<SharedClient | null>(null);

export interface SandboxProviderProps {
  children: ReactNode;
  /**
   * Use this client instead of creating one: a sandbox on another origin, or
   * one over another transport. The provider doesn't dispose a client it was given.
   */
  client?: SandboxClient;
}

export function SandboxProvider({ children, client: given }: SandboxProviderProps) {
  const legacy = useSandbox({ lazy: true });

  const clientRef = useRef<SandboxClient | null>(null);
  const [client, setClient] = useState<SandboxClient | null>(null);
  const want = useCallback(() => {
    if (given || clientRef.current) return;
    clientRef.current = new SandboxClient();
    setClient(clientRef.current);
  }, [given]);
  useEffect(
    () => () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    },
    [],
  );
  const shared = useMemo(() => ({ client: given ?? client, want }), [given, client, want]);

  return (
    <ClientContext.Provider value={shared}>
      <SandboxContext.Provider value={legacy}>{children}</SandboxContext.Provider>
    </ClientContext.Provider>
  );
}

/**
 * The sandbox client of the nearest `SandboxProvider`, or, with no provider
 * above, one of this component's own. Null on the server and until the effect
 * that creates it has run, so call it from effects and event handlers.
 */
export function useSandboxClient(): SandboxClient | null {
  const shared = useContext(ClientContext);
  const want = shared?.want;
  const [own, setOwn] = useState<SandboxClient | null>(null);

  useEffect(() => {
    if (want) {
      want();
      return;
    }
    const client = new SandboxClient();
    setOwn(client);
    return () => {
      client.dispose();
      setOwn(null);
    };
  }, [want]);

  return shared ? shared.client : own;
}

// No-op handle returned before the sandbox iframe is ready (SSR / pre-mount)
const NULL_HANDLE: SandboxHandle = {
  compile: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  compileIR: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  tick: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  tickN: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  renderSamples: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  scanPort: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  reset: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  setNode: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  snapshot: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  restore: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  pruneSnapshots: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  dispose: async () => {},
  isReady: () => false,
  status: 'loading',
};

/** The old slot sandbox. Replaced by `useSimulation` and `useSandboxClient`; removed in #417 PR 8. */
export function useSandboxContext(): SandboxHandle {
  return useContext(SandboxContext) ?? NULL_HANDLE;
}
