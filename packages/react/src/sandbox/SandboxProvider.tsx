/**
 * Which sandbox a `useSimulation` runs in.
 *
 * By default every circuit on a page shares one sandbox (decision 0010). The
 * first hook that needs it creates it, so a page with no circuits loads none,
 * and it's only ever created in the browser. Every later hook reuses it: each
 * circuit is a session in the same worker.
 *
 * `SandboxProvider` is for choosing otherwise, for everything under it. The
 * nearest provider wins.
 *   - `<SandboxProvider client={client}>` uses that client: an in-process
 *     sandbox in tests, or a sandbox hosted on another origin.
 *   - `<SandboxProvider>` with no client gives its subtree a sandbox of its
 *     own, created when the first hook under it needs it and disposed with the
 *     provider: a heavy demo gets its own core, and a hang there doesn't
 *     restart the rest of the page.
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
  useSyncExternalStore,
} from 'react';

interface SharedClient {
  /** Null until something has asked for it. */
  client: SandboxClient | null;
  /** Create the client if nobody has yet. */
  want(): void;
}

const ClientContext = createContext<SharedClient | null>(null);

// ── The page-wide sandbox ──────────────────────────────────────────────────

let pageClient: SandboxClient | null = null;
const pageListeners = new Set<() => void>();

function wantPageClient(): void {
  if (pageClient || typeof window === 'undefined') return;
  pageClient = new SandboxClient();
  for (const listener of pageListeners) listener();
}

function subscribePage(listener: () => void): () => void {
  pageListeners.add(listener);
  return () => {
    pageListeners.delete(listener);
  };
}

const getPageClient = () => pageClient;
const onServer = () => null;

// ── Provider ───────────────────────────────────────────────────────────────

export interface SandboxProviderProps {
  children: ReactNode;
  /**
   * Use this client instead of creating one: a sandbox on another origin, or
   * an in-process one in tests (`inProcessSandbox()` from `@simten/sandbox/host`).
   * The provider doesn't dispose a client it was given.
   */
  client?: SandboxClient;
}

export function SandboxProvider({ children, client: given }: SandboxProviderProps) {
  const clientRef = useRef<SandboxClient | null>(null);
  const [own, setOwn] = useState<SandboxClient | null>(null);
  const want = useCallback(() => {
    if (given || clientRef.current) return;
    clientRef.current = new SandboxClient();
    setOwn(clientRef.current);
  }, [given]);
  useEffect(
    () => () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    },
    [],
  );
  const shared = useMemo(() => ({ client: given ?? own, want }), [given, own, want]);

  return <ClientContext.Provider value={shared}>{children}</ClientContext.Provider>;
}

/**
 * The sandbox client `useSimulation` uses here: the nearest `SandboxProvider`'s,
 * or the page-wide one. For React code that compiles or exports without
 * simulating. Null on the server and until the effect that creates it has run,
 * so call it from effects and event handlers.
 */
export function useSandboxClient(): SandboxClient | null {
  const shared = useContext(ClientContext);
  const page = useSyncExternalStore(subscribePage, getPageClient, onServer);
  useEffect(() => {
    if (shared) shared.want();
    else wantPageClient();
  }, [shared]);
  return shared ? shared.client : page;
}
