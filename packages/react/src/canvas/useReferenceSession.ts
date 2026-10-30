/**
 * The second session behind a reference-build frame in the inspector.
 *
 * A primitive's gate-level build (`MADE_OF`) isn't in the running netlist, so
 * there's no path in the main session to read it from. While its frame is on
 * the stack, the build runs as its own session in the same sandbox, with
 * history off, and is fed the primitive's input values from the main session.
 * The builds are combinational, so their outputs are a function of those
 * inputs and can't drift from the primitive they explain.
 *
 * The build reaches the sandbox the way the blog's circuits do (`compile-ir`):
 * the page built it to the node's arguments to draw it, and std's source runner
 * doesn't offer `MADE_OF` to source text.
 */

import { TOP_LEVEL_NODE } from '@simten/core/internal';
import { SandboxError, type SimulationClient } from '@simten/sandbox';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSandboxClient } from '../sandbox/SandboxProvider';
import type { InspectorFrame } from './types';

const ignore = () => {};

interface ReferenceSession {
  /** The build's port map, keyed as in any session. Null until it opens. */
  ports: ReadonlyMap<string, number> | null;
  error: string | null;
}

/**
 * Opens a session for `frame`'s reference build while `frame` is set, and
 * closes it when `frame` changes or goes. `mainPorts` is the main session's
 * port map; the primitive's inputs are read from it at `frame.reference.instance`
 * and sent to the build whenever they change.
 */
export function useReferenceSession(
  frame: InspectorFrame | null,
  mainPorts: ReadonlyMap<string, number> | null,
): ReferenceSession {
  const sandbox = useSandboxClient();
  const [session, setSession] = useState<SimulationClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Input values already sent to the open session, so an unchanged parent frame sends nothing. */
  const sent = useRef(new Map<string, number>());

  const reference = frame?.reference;
  useEffect(() => {
    if (!sandbox || !reference) return;
    let cancelled = false;
    let opened: SimulationClient | null = null;
    setError(null);
    // The session owns the compile `open` makes for a page-built circuit and
    // frees it when it closes.
    sandbox.open({ circuit: reference.circuit }, { history: 0 }).then(
      (next) => {
        if (cancelled) {
          next.close().catch(ignore);
          return;
        }
        opened = next;
        sent.current = new Map();
        setSession(next);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
      opened?.close().catch(ignore);
      setSession(null);
    };
  }, [sandbox, reference]);

  // Follow the parent: send the primitive's inputs whenever they change.
  const instance = reference?.instance;
  useEffect(() => {
    if (!session || !mainPorts || instance === undefined) return;
    const changed: Record<string, number> = {};
    // A primitive drawn as the session's top level has its inputs under `__top__`.
    const at = instance || TOP_LEVEL_NODE;
    for (const port of session.circuit.inputs) {
      const value = mainPorts.get(`${at}.${port.name}`);
      if (value === undefined || sent.current.get(port.name) === value) continue;
      changed[port.name] = value;
      sent.current.set(port.name, value);
    }
    if (Object.keys(changed).length === 0) return;
    session.set(changed).catch((e: unknown) => {
      // Closed: the frame was popped while this was in flight.
      if (e instanceof SandboxError && e.code === 'closed') return;
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [session, mainPorts, instance]);

  const subscribe = useCallback(
    (listener: () => void) => (session ? session.subscribe(listener) : ignore),
    [session],
  );
  const getSnapshot = useCallback(() => session?.getState() ?? null, [session]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return { ports: state?.ports ?? null, error };
}
