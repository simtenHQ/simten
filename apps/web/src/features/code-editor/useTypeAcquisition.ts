/**
 * Automatic Type Acquisition using @typescript/ata — the same library the
 * TypeScript playground uses.
 *
 * The trick: we can't `import('typescript')` in a Vite browser build because
 * TypeScript uses Node.js built-ins that Vite doesn't polyfill. The TS
 * playground solves this by loading TypeScript from a CDN as a UMD script,
 * which is browser-safe (all Node.js fs calls are guarded by environment
 * checks). We do the same, then hand it to setupTypeAcquisition.
 */

import { useEffect, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type ts from 'typescript';

const TS_CDN = `https://cdn.jsdelivr.net/npm/typescript@5/lib/typescript.js`;

// ── TypeScript loader ──────────────────────────────────────────────────────

let tsPromise: Promise<typeof ts> | null = null;

function loadTypescript(): Promise<typeof ts> {
  if (tsPromise) return tsPromise;
  tsPromise = new Promise((resolve, reject) => {
    if ((globalThis as Record<string, unknown>).ts) {
      resolve((globalThis as Record<string, unknown>).ts as typeof ts);
      return;
    }
    const script = document.createElement('script');
    script.src = TS_CDN;
    script.onload = () => resolve((globalThis as Record<string, unknown>).ts as typeof ts);
    script.onerror = () => reject(new Error('Failed to load TypeScript from CDN'));
    document.head.appendChild(script);
  });
  return tsPromise;
}

// ── ATA setup ─────────────────────────────────────────────────────────────

type Ata = ReturnType<typeof import('@typescript/ata').setupTypeAcquisition>;

let ataInstance: Ata | null = null;
let ataMonaco: Monaco | null = null;

async function getAta(monaco: Monaco): Promise<Ata> {
  if (ataInstance && ataMonaco === monaco) return ataInstance;

  const [{ setupTypeAcquisition }, typescript] = await Promise.all([
    import('@typescript/ata'),
    loadTypescript(),
  ]);

  ataMonaco = monaco;
  ataInstance = setupTypeAcquisition({
    projectName: 'simten-editor',
    typescript,
    delegate: {
      receivedFile: (code: string, path: string) => {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(code, `file://${path}`);
      },
      started: () => {},
      progress: () => {},
      finished: () => {},
      errorMessage: (_msg: string, _err: Error) => {},
    },
  });

  return ataInstance;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTypeAcquisition(code: string, monaco: Monaco | null): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!monaco) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      getAta(monaco)
        .then((ata) => ata(code))
        .catch(() => {});
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [code, monaco]);
}
