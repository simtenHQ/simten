/**
 * SandboxProvider — singleton sandbox context
 *
 * Wraps the app so all consumers share a single hidden iframe.
 * Use `useSandboxContext()` to get the SandboxHandle.
 */

import { createContext, type ReactNode, useContext } from 'react';
import { type SandboxHandle, useSandbox } from './useSandbox.js';

const SandboxContext = createContext<SandboxHandle | null>(null);

export function SandboxProvider({ children }: { children: ReactNode }) {
  const sandbox = useSandbox();
  return <SandboxContext.Provider value={sandbox}>{children}</SandboxContext.Provider>;
}

// No-op handle returned before the sandbox iframe is ready (SSR / pre-mount)
const NULL_HANDLE: SandboxHandle = {
  compile: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  compileIR: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  tick: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  tickN: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  renderSamples: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  scanPort: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  simulate: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  reset: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  setNode: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  snapshot: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  restore: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  pruneSnapshots: async () => ({ type: 'error', error: 'Sandbox not ready' }),
  dispose: async () => {},
  isReady: () => false,
  status: 'loading',
};

export function useSandboxContext(): SandboxHandle {
  return useContext(SandboxContext) ?? NULL_HANDLE;
}
