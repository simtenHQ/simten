/**
 * Project auto-discovery.
 *
 * Convention: every direct subdirectory of projects/ that contains an
 * index.ts exporting a `project: Project` constant is registered by name at
 * load time. Drop a folder in, done — no edits to this file.
 *
 * Folders starting with `_` or `.` are skipped (useful for scratch / WIP).
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Project } from '../lib/types.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function loadProjects(): Promise<Record<string, Project>> {
  const entries = readdirSync(here, { withFileTypes: true });
  const out: Record<string, Project> = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const indexTs = resolve(here, entry.name, 'index.ts');
    const indexJs = resolve(here, entry.name, 'index.js');
    if (!existsSync(indexTs) && !existsSync(indexJs)) continue;

    try {
      const mod = (await import(`./${entry.name}/index.js`)) as { project?: Project };
      if (!mod.project) {
        console.error(`[projects] ${entry.name}/index.ts missing named export \`project\` — skipping`);
        continue;
      }
      if (!mod.project.name) {
        console.error(`[projects] ${entry.name} project missing \`name\` field — skipping`);
        continue;
      }
      out[mod.project.name] = mod.project;
    } catch (err) {
      console.error(`[projects] failed to load ${entry.name}: ${(err as Error).message}`);
    }
  }

  return out;
}

export function listProjects(loaded: Record<string, Project>): string[] {
  return Object.keys(loaded).sort();
}
