/**
 * The frozen surface (decision 0003).
 *
 * Share links and game drafts store circuit *source*, so anything that source
 * names is a contract with every player who saved it: `circuit`, `bit`, `bus`,
 * every std component name and its port names, and the `@simten/core/circuit`
 * and `@simten/core/std` import paths. Renaming or removing any of these
 * breaks saved circuits. Everything else may change before 1.0.
 *
 * `frozen-surface.json` is the committed record of that surface. This test
 * fails if anything listed there disappears. Adding a component or a port
 * fails too, until the snapshot is updated to include it:
 *
 *   SIMTEN_UPDATE_FROZEN_SURFACE=1 pnpm --filter @simten/core exec vitest run src/__tests__/frozen-surface.test.ts
 *
 * The update only ever adds. A deliberate removal means editing the JSON by
 * hand, together with a format version and a migration for stored source.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { executeCircuitCode } from '../circuit/execute.js';
import type { BuiltCircuit } from '../circuit/types.js';

interface ComponentSurface {
  /** The name source code uses in the sandbox, when it differs from the export name. */
  scopeName?: string;
  inputs: string[];
  outputs: string[];
}

interface FrozenSurface {
  importPaths: string[];
  circuitApi: string[];
  std: Record<string, ComponentSurface>;
}

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(here, 'frozen-surface.json');
const PACKAGE_JSON_PATH = join(here, '../../package.json');
const BREAKS = 'This breaks saved circuits; see decision 0003.';

const isBuilt = (v: unknown): v is BuiltCircuit => !!v && typeof v === 'object' && 'circuit' in v;

/** A std export as source sees it: a component, or a factory called with its defaults. */
function describeExport(exportName: string, value: unknown): ComponentSurface | null {
  let built: BuiltCircuit | null = null;
  let scopeName = exportName;
  if (isBuilt(value)) {
    built = value;
    // The sandbox injects components by their circuit name (execute.ts buildScope).
    scopeName = value.circuit.name;
  } else if (typeof value === 'function') {
    try {
      const made = (value as () => unknown)();
      if (isBuilt(made)) built = made;
    } catch {
      return null;
    }
  }
  if (!built) return null;
  return {
    ...(scopeName !== exportName ? { scopeName } : {}),
    inputs: built.circuit.inputs.map((p) => p.name).sort(),
    outputs: built.circuit.outputs.map((p) => p.name).sort(),
  };
}

const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
  exports: Record<string, string>;
  publishConfig: { exports: Record<string, unknown> };
};

/** Load a public entry point through the file package.json maps it to. */
async function importEntry(path: string): Promise<Record<string, unknown>> {
  const subpath = `.${path.slice('@simten/core'.length)}`;
  const target = packageJson.exports[subpath];
  if (!target) return {};
  return (await import(join(here, '../..', target))) as Record<string, unknown>;
}

async function currentSurface(frozen: FrozenSurface): Promise<FrozenSurface> {
  const circuitModule = await importEntry('@simten/core/circuit');
  const stdModule = await importEntry('@simten/core/std');

  const std: Record<string, ComponentSurface> = {};
  for (const [name, value] of Object.entries(stdModule)) {
    const surface = describeExport(name, value);
    if (surface) std[name] = surface;
  }

  return {
    importPaths: frozen.importPaths.filter((p) => {
      const subpath = `.${p.slice('@simten/core'.length)}`;
      return subpath in packageJson.exports && subpath in packageJson.publishConfig.exports;
    }),
    circuitApi: frozen.circuitApi.filter((n) => circuitModule[n] !== undefined),
    std,
  };
}

/** Everything in `frozen` that `current` no longer has. */
function removals(frozen: FrozenSurface, current: FrozenSurface): string[] {
  const out: string[] = [];
  for (const p of frozen.importPaths) {
    if (!current.importPaths.includes(p)) out.push(`import path '${p}' is gone`);
  }
  for (const n of frozen.circuitApi) {
    if (!current.circuitApi.includes(n)) out.push(`'${n}' is no longer exported`);
  }
  for (const [name, was] of Object.entries(frozen.std)) {
    const now = current.std[name];
    if (!now) {
      out.push(`std component '${name}' was removed or renamed`);
      continue;
    }
    if ((was.scopeName ?? name) !== (now.scopeName ?? name)) {
      out.push(`std component '${name}' is now called '${now.scopeName ?? name}' in source`);
    }
    for (const dir of ['inputs', 'outputs'] as const) {
      for (const port of was[dir]) {
        if (!now[dir].includes(port)) {
          out.push(`std component '${name}' lost ${dir.slice(0, -1)} port '${port}'`);
        }
      }
    }
  }
  return out;
}

/** Everything in `current` that the snapshot has not recorded yet. */
function additions(frozen: FrozenSurface, current: FrozenSurface): string[] {
  const out: string[] = [];
  for (const [name, now] of Object.entries(current.std)) {
    const was = frozen.std[name];
    if (!was) {
      out.push(`std component '${name}'`);
      continue;
    }
    for (const dir of ['inputs', 'outputs'] as const) {
      for (const port of now[dir]) {
        if (!was[dir].includes(port)) out.push(`'${name}' ${dir.slice(0, -1)} port '${port}'`);
      }
    }
  }
  return out;
}

/** Snapshot plus additions; never drops anything already frozen. */
function merged(frozen: FrozenSurface, current: FrozenSurface): FrozenSurface {
  const std: Record<string, ComponentSurface> = { ...frozen.std };
  for (const [name, now] of Object.entries(current.std)) {
    const was = std[name];
    std[name] = was
      ? {
          ...was,
          inputs: [...new Set([...was.inputs, ...now.inputs])].sort(),
          outputs: [...new Set([...was.outputs, ...now.outputs])].sort(),
        }
      : now;
  }
  const sorted = Object.fromEntries(Object.entries(std).sort(([a], [b]) => a.localeCompare(b)));
  return { ...frozen, std: sorted };
}

/** JSON laid out the way Biome formats it, so an update leaves `biome ci` clean. */
function serialize(surface: FrozenSurface): string {
  const field = (indent: string, key: string, values: string[], comma: string) => {
    const inline = `${indent}"${key}": ${JSON.stringify(values).replaceAll('","', '", "')}${comma}`;
    if (inline.length <= 100) return [inline];
    return [
      `${indent}"${key}": [`,
      ...values.map((v, i) => `${indent}  ${JSON.stringify(v)}${i < values.length - 1 ? ',' : ''}`),
      `${indent}]${comma}`,
    ];
  };
  const entries = Object.entries(surface.std);
  return [
    '{',
    ...field('  ', 'importPaths', surface.importPaths, ','),
    ...field('  ', 'circuitApi', surface.circuitApi, ','),
    '  "std": {',
    ...entries.flatMap(([name, c], i) => [
      `    "${name}": {`,
      ...(c.scopeName ? [`      "scopeName": ${JSON.stringify(c.scopeName)},`] : []),
      ...field('      ', 'inputs', c.inputs, ','),
      ...field('      ', 'outputs', c.outputs, ''),
      `    }${i < entries.length - 1 ? ',' : ''}`,
    ]),
    '  }',
    '}',
    '',
  ].join('\n');
}

const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as FrozenSurface;

const current = await currentSurface(committed);
const update = Boolean(process.env.SIMTEN_UPDATE_FROZEN_SURFACE);
const frozen = update ? merged(committed, current) : committed;
if (update) writeFileSync(SNAPSHOT_PATH, serialize(frozen));

describe('frozen surface (decision 0003)', () => {
  it('keeps every frozen name, port and import path', () => {
    const lost = removals(frozen, current);
    expect(lost, `${BREAKS}\n  ${lost.join('\n  ')}\n`).toEqual([]);
  });

  it('has every current std component and port recorded in the snapshot', () => {
    const added = additions(frozen, current);
    expect(
      added,
      `Not yet frozen. Run SIMTEN_UPDATE_FROZEN_SURFACE=1 pnpm --filter @simten/core exec vitest run src/__tests__/frozen-surface.test.ts\n  ${added.join('\n  ')}\n`,
    ).toEqual([]);
  });

  it('resolves every frozen name in circuit source, as the sandbox runs it', () => {
    // Saved source references these as bare identifiers; a ReferenceError here
    // is exactly what a player's old draft would hit.
    const names = [
      ...frozen.circuitApi,
      ...Object.entries(frozen.std).map(([name, c]) => c.scopeName ?? name),
    ];
    const result = executeCircuitCode(`const __frozen = [${names.join(', ')}];`);
    expect(result.error, BREAKS).toBeNull();
  });
});
