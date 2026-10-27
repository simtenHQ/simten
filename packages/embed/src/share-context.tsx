import { createContext, type ReactNode, useContext } from 'react';

/**
 * Function that persists a circuit source to KV and returns a content-addressed
 * hash. The hash plugs into the `/circuit/s/<hash>` route. The simten.dev site
 * provides its own (its TanStack Start `shareCircuit` server function); every
 * other page gets `postShare`, which calls simten.dev's public share endpoint.
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
  return <ShareCircuitContext.Provider value={value}>{children}</ShareCircuitContext.Provider>;
}

/**
 * Where Fork links open and shares are created: simten.dev, except in local dev
 * of Simten itself, where the page is on localhost. Decided at runtime because
 * embeds run on other people's origins, unknown at build time.
 */
export function simtenHost(): string {
  if (typeof window === 'undefined') return 'https://simten.dev';
  return window.location.hostname === 'localhost' ? window.location.origin : 'https://simten.dev';
}

/** Creates a share link through simten.dev's `POST /api/share`, which answers CORS. */
async function postShare(source: string): Promise<{ hash: string }> {
  const res = await fetch(`${simtenHost()}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  const body = (await res.json().catch(() => ({}))) as { hash?: unknown; error?: unknown };
  if (!res.ok || typeof body.hash !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : "Couldn't fork this circuit");
  }
  return { hash: body.hash };
}

export function useShareCircuit(): ShareCircuitFn {
  return useContext(ShareCircuitContext) ?? postShare;
}
