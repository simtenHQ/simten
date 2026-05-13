import { createContext, useContext, type ReactNode } from "react";

/**
 * Function that persists a circuit source to KV and returns a content-addressed
 * hash. The hash plugs into the `/circuit/s/<hash>` route. Provided by the host
 * app (apps/web wires this to its TanStack Start `shareCircuit` server fn);
 * when unset, Fork buttons fall back to the legacy inline `/circuit/<encoded>`
 * URL. The fallback exists for embeds outside simten.dev — the simten.dev site
 * always supplies the provider.
 */
export type ShareCircuitFn = (source: string) => Promise<{ hash: string }>;

const ShareCircuitContext = createContext<ShareCircuitFn | null>(null);

export function ShareCircuitProvider({
  value,
  children,
}: {
  value: ShareCircuitFn;
  children: ReactNode;
}) {
  return (
    <ShareCircuitContext.Provider value={value}>
      {children}
    </ShareCircuitContext.Provider>
  );
}

export function useShareCircuit(): ShareCircuitFn | null {
  return useContext(ShareCircuitContext);
}
