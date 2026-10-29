/**
 * useTypeAcquisition — resolve third-party imports (`react`, `zod`, ...) to real
 * types, using @typescript/ata: the same library the TypeScript playground uses.
 *
 * ATA parses the source for import specifiers, fetches the matching .d.ts /
 * @types packages from jsDelivr, and walks the transitive graph. Each file it
 * hands back is planted into Monaco's virtual filesystem at a path shaped like a
 * real node_modules tree — which is what lets `moduleResolution: NodeJs` (set in
 * ./setup) resolve a bare `import React from 'react'`.
 *
 * The TypeScript-from-CDN dance is not incidental: we can't `import('typescript')`
 * in a browser build, because TypeScript reaches for Node built-ins that bundlers
 * won't polyfill. Loading the UMD build via a script tag is browser-safe (its fs
 * calls are environment-guarded) and is the same trick the playground uses.
 *
 * Best-effort by design: every failure path is swallowed. No network, a CSP that
 * blocks jsDelivr, or a package that ships no types all degrade to "no
 * completions for that import" while the editor keeps working.
 */

import type { Monaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import type ts from 'typescript';

/** Debounce before (re)running acquisition after an edit. */
const ATA_DEBOUNCE_MS = 500;

const DEFAULT_TS_CDN = 'https://cdn.jsdelivr.net/npm/typescript@5/lib/typescript.js';

export interface TypeAcquisitionOptions {
  /**
   * Where to load the TypeScript UMD build from. Point this at a self-hosted
   * copy if jsDelivr is blocked by your CSP.
   * @default 'https://cdn.jsdelivr.net/npm/typescript@5/lib/typescript.js'
   */
  typescriptCdn?: string;
  /**
   * Disable network type acquisition entirely. Simten's own types still resolve
   * (they're inlined by `setupSimtenIntellisense`); third-party imports won't.
   * @default true
   */
  enabled?: boolean;
}

// ── TypeScript loader ───────────────────────────────────────────────────────

let tsPromise: Promise<typeof ts> | null = null;

function loadTypescript(cdn: string): Promise<typeof ts> {
  if (tsPromise) return tsPromise;
  tsPromise = new Promise((resolve, reject) => {
    const existing = (globalThis as Record<string, unknown>).ts;
    if (existing) {
      resolve(existing as typeof ts);
      return;
    }
    const script = document.createElement('script');
    script.src = cdn;
    script.onload = () => resolve((globalThis as Record<string, unknown>).ts as typeof ts);
    script.onerror = () => reject(new Error(`Failed to load TypeScript from ${cdn}`));
    document.head.appendChild(script);
  });
  return tsPromise;
}

// ── ATA singleton ───────────────────────────────────────────────────────────

type Ata = ReturnType<typeof import('@typescript/ata').setupTypeAcquisition>;

// Module-level so ATA is constructed once per Monaco instance rather than per
// mount — it keeps an internal cache of what it has already fetched, and
// rebuilding it would re-download the whole graph.
let ataInstance: Ata | null = null;
let ataMonaco: Monaco | null = null;

async function getAta(monaco: Monaco, cdn: string): Promise<Ata> {
  if (ataInstance && ataMonaco === monaco) return ataInstance;

  const [{ setupTypeAcquisition }, typescript] = await Promise.all([
    import('@typescript/ata'),
    loadTypescript(cdn),
  ]);

  ataMonaco = monaco;
  ataInstance = setupTypeAcquisition({
    projectName: 'simten',
    typescript,
    delegate: {
      // ATA's `path` already looks like /node_modules/@types/react/index.d.ts,
      // so `file://` + path lands exactly where the compiler options expect it.
      receivedFile: (code: string, path: string) => {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(code, `file://${path}`);
      },
      started: () => {},
      progress: () => {},
      finished: () => {},
      errorMessage: () => {},
    },
  });

  return ataInstance;
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Re-runs type acquisition when `source` settles. Pass `monaco` once it exists
 * (i.e. from `beforeMount`/`onMount`); null is a no-op.
 *
 * `SimtenCodeEditor` calls this for you — reach for it directly only when you
 * are wiring Monaco yourself.
 */
export function useTypeAcquisition(
  source: string,
  monaco: Monaco | null,
  options: TypeAcquisitionOptions = {},
): void {
  const { typescriptCdn = DEFAULT_TS_CDN, enabled = true } = options;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!monaco || !enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      getAta(monaco, typescriptCdn)
        .then((ata) => ata(source))
        .catch(() => {});
    }, ATA_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [source, monaco, enabled, typescriptCdn]);
}
