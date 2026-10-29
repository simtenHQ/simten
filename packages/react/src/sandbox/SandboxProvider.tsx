/**
 * SandboxProvider: one sandbox for everything under it.
 *
 * It holds one `SandboxClient` (one hidden iframe), which `useSimulation` and
 * `useSandboxClient` use. The client is created when the first of them mounts,
 * so a page with no circuits loads no sandbox.
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

interface SharedClient {
  /** Null until something has asked for it, and on the server. */
  client: SandboxClient | null;
  /** Create the client if nobody has yet. */
  want(): void;
}

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

  return <ClientContext.Provider value={shared}>{children}</ClientContext.Provider>;
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
