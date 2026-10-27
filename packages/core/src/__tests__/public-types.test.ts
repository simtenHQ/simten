/**
 * The public entry points expose only public types, both ways round.
 *
 * - Every type a public value's signature reaches is exported from some public
 *   entry, so nothing internal (the IR, engine snapshots, libraries) leaks
 *   through a parameter or return type where users can't name it.
 * - Every type a public entry exports is reached from some public value, so
 *   the entries don't carry types that nothing uses.
 *
 * Signatures are read with the TypeScript checker: declared types by their
 * syntax, inferred ones (`export const And = circuit(...)`) by their type.
 * Function bodies are skipped; only what a caller can see counts.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENTRIES = [
  'index.ts',
  'circuit/index.ts',
  'std/index.ts',
  'verify/index.ts',
  'verilog/index.ts',
  'examples/index.ts',
].map((e) => join(src, e));

/**
 * Types a public signature may reach without being exported: helpers that
 * compute a public type from the user's own config, which there is no reason
 * to name.
 */
const UNEXPORTED_HELPERS: Record<string, string> = {
  NormalizePorts: "maps `circuit()`'s port config to port types",
  NormalizePort: 'one port of NormalizePorts',
  SourceRefs: "a ConnectContext's source port refs, by port name",
  SinkRefs: "a ConnectContext's sink port refs, by port name",
  PortOutputValues: "what `eval` may return, from the config's outputs",
  ResolvedState: 'state as `eval` and `onTick` see it, from the config',
  ResolvedStateValue: 'one field of ResolvedState',
  ResolvedStateReturn: 'what `onTick` may return, from the config',
  ResolvedStateReturnValue: 'one field of ResolvedStateReturn',
  MemoryAccess: 'a `mem()` field as `eval` reads it: a Map that also indexes',
  StateFieldValue: 'what a `state` field may hold as written',
  BitPorts: 'the ports `Splitter`/`Combiner` get from their width',
  BitIndex: 'the bit numbers in BitPorts',
  CoreIns: "a std CPU core's input ports, written out once",
  CoreOuts: "a std CPU core's output ports, written out once",
  B: 'shorthand for BusType in a std CPU file',
  Bit: 'shorthand for BitType in a std CPU file',
};

/** Exported types no value's signature uses, and why they are still public. */
const UNREACHED_EXPORTS: Record<string, string> = {
  VerifyResult: 'the JSON `verify.run()` prints between VERIFY_JSON_BEGIN and VERIFY_JSON_END',
  VerifyContractError: 'the JSON `verify.run()` prints when a testbench breaks the contract',
  CheckSummary: 'part of VerifyResult',
  VerifyFailure: 'part of VerifyResult',
  VerifyCounterexample: 'part of VerifyResult',
  BitValue: "a bit port's value (0 or 1), as the canvas and embeds type port values",
  BusValue: "a bus port's value, as the canvas and embeds type port values",
};

const program = ts.createProgram(ENTRIES, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
});
const checker = program.getTypeChecker();

const TYPE_FLAGS =
  ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum;
const VALUE_FLAGS = ts.SymbolFlags.Function | ts.SymbolFlags.Variable;

const resolve = (s: ts.Symbol): ts.Symbol =>
  s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;

const isOurs = (s: ts.Symbol): boolean =>
  (s.declarations ?? []).some((d) => !d.getSourceFile().fileName.includes('/node_modules/'));

function exportsOf(entry: string): ts.Symbol[] {
  const file = program.getSourceFile(entry);
  const moduleSymbol = file && checker.getSymbolAtLocation(file);
  if (!moduleSymbol) throw new Error(`cannot read ${entry}`);
  return checker.getExportsOfModule(moduleSymbol).map(resolve);
}

/** Every type a public value's signature reaches, with the path it was reached by. */
function reachedTypes(values: ts.Symbol[]): Map<ts.Symbol, string> {
  const reached = new Map<ts.Symbol, string>();
  const seenNodes = new Set<ts.Node>();
  const seenTypes = new Set<ts.Type>();

  const reachSymbol = (symbol: ts.Symbol, path: string): void => {
    if (reached.has(symbol) || !(symbol.flags & TYPE_FLAGS) || !isOurs(symbol)) return;
    reached.set(symbol, path);
    for (const d of symbol.declarations ?? []) visitNode(d, `${path} > ${symbol.name}`);
  };

  const visitType = (type: ts.Type, path: string): void => {
    if (seenTypes.has(type)) return;
    seenTypes.add(type);
    if (type.aliasSymbol) {
      reachSymbol(type.aliasSymbol, path);
      for (const arg of type.aliasTypeArguments ?? []) visitType(arg, path);
      if (isOurs(type.aliasSymbol)) return;
    }
    if (type.isUnionOrIntersection()) {
      for (const t of type.types) visitType(t, path);
      return;
    }
    if (!(type.flags & ts.TypeFlags.Object)) return;
    const objectFlags = (type as ts.ObjectType).objectFlags;
    if (objectFlags & ts.ObjectFlags.Reference) {
      for (const arg of checker.getTypeArguments(type as ts.TypeReference)) visitType(arg, path);
    }
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & TYPE_FLAGS) {
      reachSymbol(symbol, path);
      return;
    }
    // An anonymous type (an object literal, a function): its members.
    for (const prop of type.getProperties()) {
      visitType(checker.getTypeOfSymbol(prop), `${path}.${prop.name}`);
    }
    for (const sig of [...type.getCallSignatures(), ...type.getConstructSignatures()]) {
      for (const p of sig.getParameters()) visitType(checker.getTypeOfSymbol(p), path);
      visitType(sig.getReturnType(), path);
    }
  };

  const visitNode = (node: ts.Node, path: string): void => {
    if (seenNodes.has(node)) return;
    seenNodes.add(node);
    // A function body is not part of its signature.
    if (ts.isBlock(node)) return;
    // A variable without a declared type has the type of its value.
    if (ts.isVariableDeclaration(node)) {
      if (node.type) visitNode(node.type, path);
      else visitType(checker.getTypeAtLocation(node.name), path);
      return;
    }
    // A function without a declared return type returns what its body returns.
    if (ts.isFunctionLike(node) && !node.type) {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature) visitType(signature.getReturnType(), path);
    }
    if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
      const name = ts.isTypeReferenceNode(node) ? node.typeName : node.expression;
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol) reachSymbol(resolve(symbol), path);
    }
    if (ts.isTypeQueryNode(node)) {
      visitType(checker.getTypeAtLocation(node), path);
    }
    ts.forEachChild(node, (child) => visitNode(child, path));
  };

  for (const value of values) {
    const declarations = value.declarations ?? [];
    for (const d of declarations) {
      // An overloaded function's implementation signature isn't callable.
      const isImplementation = ts.isFunctionDeclaration(d) && d.body && declarations.length > 1;
      if (!isImplementation) visitNode(d, value.name);
    }
  }
  return reached;
}

const entryExports = ENTRIES.map(exportsOf);
const all = entryExports.flat();
const publicValues = [...new Set(all.filter((s) => s.flags & VALUE_FLAGS))];
const publicTypes = new Set(all.filter((s) => !(s.flags & VALUE_FLAGS) && s.flags & TYPE_FLAGS));
const reached = reachedTypes(publicValues);

describe('public types', () => {
  it('every type a public signature reaches is public', () => {
    const leaks = [...reached]
      .filter(([s]) => !publicTypes.has(s) && !(s.name in UNEXPORTED_HELPERS))
      .map(([s, path]) => `${s.name} (via ${path})`);
    expect(leaks).toEqual([]);
  });

  it('every type a public entry exports is used by a public value', () => {
    const unused = [...publicTypes]
      .filter((s) => !reached.has(s) && !(s.name in UNREACHED_EXPORTS))
      .map((s) => s.name);
    expect(unused).toEqual([]);
  });

  it('keeps its allowlists current', () => {
    const names = new Set([...reached.keys()].map((s) => s.name));
    const staleHelpers = Object.keys(UNEXPORTED_HELPERS).filter((n) => !names.has(n));
    const exported = new Set([...publicTypes].map((s) => s.name));
    const staleExports = Object.keys(UNREACHED_EXPORTS).filter(
      (n) => !exported.has(n) || names.has(n),
    );
    expect([...staleHelpers, ...staleExports]).toEqual([]);
  });
});
