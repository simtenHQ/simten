/**
 * Drafts and share links saved before decision 0010 import `circuit`, `bit`
 * and `bus` from `@simten/core/circuit`, which the package no longer exports.
 * They still run, because the sandbox strips imports before running source
 * (core's `stripImports`); this checks they still type-check in the editor,
 * which keeps the old path as an alias of `@simten/core`.
 *
 * The libs `setupSimtenIntellisense` plants are fed to the TypeScript compiler
 * with the editor's options, and a draft written against the old path is
 * checked against them.
 */

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { setupSimtenIntellisense } from '../setup';

/** The files `setupSimtenIntellisense` gives Monaco, by path. */
function plantedLibs(): Map<string, string> {
  const libs = new Map<string, string>();
  const noop = () => {};
  const fakeMonaco = {
    languages: {
      typescript: {
        ScriptTarget: { ESNext: ts.ScriptTarget.ESNext },
        ModuleKind: { ESNext: ts.ModuleKind.ESNext },
        ModuleResolutionKind: { NodeJs: ts.ModuleResolutionKind.Node10 },
        typescriptDefaults: {
          addExtraLib: (contents: string, path: string) => libs.set(path, contents),
          setEagerModelSync: noop,
          setCompilerOptions: noop,
          setDiagnosticsOptions: noop,
        },
      },
      registerCompletionItemProvider: () => ({ dispose: noop }),
    },
    editor: { getModel: () => null },
    Uri: { parse: (path: string) => path },
  };
  setupSimtenIntellisense(fakeMonaco as never, { snippets: false });
  return libs;
}

function diagnosticsFor(draft: string): string[] {
  const files = new Map<string, string>();
  for (const [path, contents] of plantedLibs()) files.set(path.replace('file://', ''), contents);
  files.set('/circuit.ts', draft);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const original = { ...host };
  host.fileExists = (name) => files.has(name) || original.fileExists(name);
  // The planted files live in a virtual tree, as Monaco's do.
  host.directoryExists = (dir) =>
    [...files.keys()].some((f) => f.startsWith(`${dir}/`)) ||
    original.directoryExists?.(dir) === true;
  host.readFile = (name) => files.get(name) ?? original.readFile(name);
  host.getSourceFile = (name, version) => {
    const text = files.get(name);
    return text === undefined
      ? original.getSourceFile(name, version)
      : ts.createSourceFile(name, text, version);
  };
  const program = ts.createProgram(
    [...files.keys()].filter((f) => f.endsWith('.ts')),
    options,
    host,
  );
  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile('/circuit.ts'))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('the old @simten/core/circuit import path in the editor', () => {
  it('type-checks a draft that imports circuit, bit and bus from it', () => {
    const draft = `
import { circuit, bit, bus } from '@simten/core/circuit';
import { And } from '@simten/core/std';

export const Gate = circuit('Gate', {
  inputs: { a: bit, b: bit, n: bus(4) },
  outputs: { y: bit },
  nodes: { g: And },
  connect: ({ inputs, outputs, nodes: { g } }) => [
    inputs.a.to(g.a),
    inputs.b.to(g.b),
    g.out.to(outputs.y),
  ],
});
`;
    expect(diagnosticsFor(draft)).toEqual([]);
  });

  it('is typed, not any: a wrong port is still an error', () => {
    const draft = `
import { circuit, bit } from '@simten/core/circuit';
import { And } from '@simten/core/std';

export const Gate = circuit('Gate', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { g: And },
  connect: ({ inputs, outputs, nodes: { g } }) => [inputs.a.to(g.nope), g.out.to(outputs.y)],
});
`;
    expect(diagnosticsFor(draft).join('\n')).toMatch(/nope/);
  });
});
