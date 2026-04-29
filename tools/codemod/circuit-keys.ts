/**
 * Codemod: rename circuit() builder keys `in:` / `out:` → `inputs:` / `outputs:`
 * and reshape the connect callback's destructure parameter.
 *
 * Usage:
 *   pnpm exec tsx tools/codemod/circuit-keys.ts --check          # dry run, list changes
 *   pnpm exec tsx tools/codemod/circuit-keys.ts --apply           # write
 *   pnpm exec tsx tools/codemod/circuit-keys.ts --apply <file>... # narrow to files
 *
 * Two-pass per file:
 *   Pass 1 — sanity check, refuse anything we don't understand.
 *   Pass 2 — three transforms:
 *     a. Rename `in:` → `inputs:`, `out:` → `outputs:` in circuit() config
 *     b. Rewrite the connect callback's destructure to {inputs,outputs,nodes:{...}}
 *     c. Rewrite body references: <inAlias>.X → inputs.X, <outAlias>.X → outputs.X
 */

import { Project, SyntaxKind, Node, type ObjectLiteralExpression, type ArrowFunction, type ObjectBindingPattern, type CallExpression } from 'ts-morph';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const check = args.includes('--check') || !apply;
const explicitFiles = args.filter(a => !a.startsWith('--'));

if (!apply && !check) {
  console.error('Usage: codemod --check | --apply [files...]');
  process.exit(1);
}

// ── File discovery ──────────────────────────────────────────────────────────

function discoverFiles(): string[] {
  if (explicitFiles.length > 0) return explicitFiles.map(f => resolve(f));

  // grep for files containing `circuit(` invocations across known dirs.
  const dirs = [
    'packages/core/src',
    'packages/embed/src',
    'apps/tanstack/src',
    'apps/sandbox/src',
    'hardware/ulx3s',
    'demos/cli',
  ];
  const out = execSync(
    `grep -rlE --include='*.ts' --include='*.tsx' "circuit\\(" ${dirs.filter(d => {
      try { return readFileSync; } catch { return false; }
    }).join(' ')} 2>/dev/null || true`,
    { encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).map(p => resolve(p));
}

// ── Pass 1: sanity check ────────────────────────────────────────────────────

interface SanityIssue {
  file: string;
  line: number;
  reason: string;
}

function checkConnectArrow(arrow: ArrowFunction, file: string, issues: SanityIssue[]): void {
  const params = arrow.getParameters();
  // Tolerate `connect: () => [...]` — empty connect callback. The config keys
  // still get renamed; there's no destructure to rewrite.
  if (params.length === 0) return;
  if (params.length !== 1) {
    issues.push({ file, line: arrow.getStartLineNumber(), reason: `connect arrow has ${params.length} params, expected 1` });
    return;
  }
  const binding = params[0].getNameNode();
  if (!Node.isObjectBindingPattern(binding)) {
    issues.push({ file, line: arrow.getStartLineNumber(), reason: 'connect param is not an object destructure' });
    return;
  }
  for (const elem of binding.getElements()) {
    if (elem.getDotDotDotToken()) {
      issues.push({ file, line: elem.getStartLineNumber(), reason: 'connect destructure uses spread (...rest), not supported' });
    }
    const nameNode = elem.getNameNode();
    if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
      // A nested object pattern under a property name is OK if it's the new
      // shape's `nodes: { ... }` — that means this circuit has already been
      // migrated and we should skip it. Detect by looking at the property name.
      const propNameNode = elem.getPropertyNameNode();
      if (propNameNode && propNameNode.getText() === 'nodes') continue;
      issues.push({ file, line: elem.getStartLineNumber(), reason: 'connect destructure has nested pattern, not supported' });
    }
  }
}

// ── Pass 2: transforms ──────────────────────────────────────────────────────

interface TransformResult {
  rewrittenCircuits: number;
}

/**
 * Look at the second arg of `circuit(name, { ... })` — the config object.
 * - Returns the object literal if found, plus whether it has `in:` / `out:` /
 *   `connect:` keys, and the connect arrow if any.
 */
function readConfig(call: CallExpression): {
  obj: ObjectLiteralExpression | null;
  inProp: ReturnType<ObjectLiteralExpression['getProperty']> | undefined;
  outProp: ReturnType<ObjectLiteralExpression['getProperty']> | undefined;
  connectArrow: ArrowFunction | null;
} {
  const arg = call.getArguments()[1];
  if (!arg || !Node.isObjectLiteralExpression(arg)) {
    return { obj: null, inProp: undefined, outProp: undefined, connectArrow: null };
  }
  const inProp = arg.getProperty('in');
  const outProp = arg.getProperty('out');
  const connectProp = arg.getProperty('connect');
  let connectArrow: ArrowFunction | null = null;
  if (connectProp && Node.isPropertyAssignment(connectProp)) {
    const init = connectProp.getInitializer();
    if (init && Node.isArrowFunction(init)) {
      connectArrow = init;
    }
  }
  return { obj: arg, inProp, outProp, connectArrow };
}

function renameConfigKey(prop: ReturnType<ObjectLiteralExpression['getProperty']>, newName: string): void {
  if (!prop) return;
  if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop) || Node.isMethodDeclaration(prop)) {
    prop.rename(newName);
  }
}

/**
 * Given the connect arrow's param destructure pattern + the captured aliases for
 * inputs/outputs, rewrite the destructure source text and the body's references.
 *
 * `actualNodeNames` is the set of names actually declared in `nodes:`. Used to
 * drop bogus destructure entries — historically the codebase had circuits where
 * `connect: ({ in: inp, out, ...realNodes })` declared `inp` and `out` even
 * when the config had no `in:` / `out:` keys (latent TS6133 unused-variable
 * warnings). Now that the migration tightens the type, we must drop them.
 */
function rewriteConnectArrow(
  arrow: ArrowFunction,
  hasInputs: boolean,
  hasOutputs: boolean,
  actualNodeNames: Set<string>,
): void {
  const param = arrow.getParameters()[0];
  const binding = param.getNameNode() as ObjectBindingPattern;

  // Walk the destructure elements.
  // Each element is one of:
  //   {  in: someAlias  } — propertyName = 'in', name = someAlias (id)
  //   {  in            } — shorthand (rare; would shadow reserved word, but possible if user typed it)
  //   {  out: alias    } — propertyName = 'out', name = alias
  //   {  out           } — shorthand for `out`
  //   {  someNodeName  } — shorthand, a node name
  //   {  someNodeName: alias } — node renamed (we asserted in pass 1 this doesn't happen)
  let inAlias: string | null = null;
  let outAlias: string | null = null;
  const nodeNames: string[] = [];

  for (const elem of binding.getElements()) {
    const propNameNode = elem.getPropertyNameNode();
    const nameNode = elem.getNameNode();
    const nameText = nameNode.getText();

    if (propNameNode) {
      // Renamed: e.g. `in: inp`, `out: o`. propertyName is the source key, name is the alias.
      const sourceKey = propNameNode.getText();
      if (sourceKey === 'in') {
        inAlias = nameText;
      } else if (sourceKey === 'out') {
        outAlias = nameText;
      } else {
        // Node renamed (we don't expect this from drift check, but handle defensively).
        nodeNames.push(`${sourceKey}: ${nameText}`);
      }
    } else {
      // Shorthand: name = key.
      if (nameText === 'in') {
        // Unrenamed `in` — would be a syntax error in valid JS (reserved word as binding).
        // Should never happen in practice; treat as bare reference.
        inAlias = 'in';
      } else if (nameText === 'out') {
        // `out` shorthand — disambiguate via the config's `out:` key first,
        // then via the actual node names. Bogus destructure leftovers (where
        // `out` is neither a port nor a real node) get dropped.
        if (hasOutputs) {
          outAlias = 'out';
        } else if (actualNodeNames.has('out')) {
          nodeNames.push(nameText);
        }
        // else: drop. Was a latent unused-variable bug pre-migration.
      } else if (actualNodeNames.has(nameText)) {
        nodeNames.push(nameText);
      }
      // else: drop. Bogus destructure entry that doesn't correspond to anything.
    }
  }

  // ── Build the new destructure source ──
  const parts: string[] = [];
  if (hasInputs) parts.push('inputs');
  if (hasOutputs) parts.push('outputs');
  if (nodeNames.length > 0) parts.push(`nodes: { ${nodeNames.join(', ')} }`);

  if (process.env.TRACE === '1') {
    console.error(`    rewrite: inAlias=${inAlias} outAlias=${outAlias} nodeNames=[${nodeNames.join(',')}] → { ${parts.join(', ')} }`);
  }

  const newDestructure = `{ ${parts.join(', ')} }`;
  binding.replaceWithText(newDestructure);

  // ── Rewrite body references that used the captured aliases ──
  // After replaceWithText we have to re-fetch the body since the AST may have
  // shifted. Use the arrow's body now.
  const body = arrow.getBody();

  // Find all property-access expressions whose root identifier matches the
  // captured alias and rewrite the root.
  body.forEachDescendant((descendant) => {
    if (Node.isPropertyAccessExpression(descendant)) {
      const expr = descendant.getExpression();
      if (Node.isIdentifier(expr)) {
        const text = expr.getText();
        if (inAlias && text === inAlias) {
          expr.replaceWithText('inputs');
        } else if (outAlias && text === outAlias) {
          expr.replaceWithText('outputs');
        }
      }
    }
  });
}

function transformCircuitCall(call: CallExpression): boolean {
  const { obj, inProp, outProp, connectArrow } = readConfig(call);
  if (!obj) return false;

  const hasInputs = !!inProp;
  const hasOutputs = !!outProp;

  // Collect the set of actually-declared node names so the destructure rewrite
  // can drop bogus entries (e.g. `out` declared but not a node, no `out:` config).
  const nodesProp = obj.getProperty('nodes');
  const actualNodeNames = new Set<string>();
  if (nodesProp && Node.isPropertyAssignment(nodesProp)) {
    const init = nodesProp.getInitializer();
    if (init && Node.isObjectLiteralExpression(init)) {
      for (const p of init.getProperties()) {
        if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
          actualNodeNames.add(p.getName());
        }
      }
    }
  }

  if (process.env.TRACE === '1') {
    const nameArg = call.getArguments()[0];
    const circuitName = nameArg ? nameArg.getText() : '?';
    console.error(`  [trace] ${circuitName}: hasInputs=${hasInputs} hasOutputs=${hasOutputs} connect=${!!connectArrow}`);
  }

  // Skip circuits already in the new shape — they have neither `in:` nor `out:`.
  // (Circuits that genuinely have neither, like top-level demos with only nodes,
  // also fall through here. Their connect callback may still need destructure
  // rewrite IF it uses the old `({ ...nodes })` shape. We check the connect
  // arrow's params to disambiguate.)
  if (!hasInputs && !hasOutputs) {
    if (!connectArrow) return false;
    // If the connect destructure already has a `nodes:` key, it's migrated.
    const param = connectArrow.getParameters()[0];
    if (param) {
      const binding = param.getNameNode();
      if (Node.isObjectBindingPattern(binding)) {
        const hasNodesKey = binding.getElements().some(e => {
          const prop = e.getPropertyNameNode();
          return prop && prop.getText() === 'nodes';
        });
        if (hasNodesKey) return false; // already migrated
      }
    }
  }

  // Rewrite connect FIRST (before key renames invalidate property positions —
  // ts-morph generally handles this but order is safer).
  if (connectArrow && connectArrow.getParameters().length > 0) {
    rewriteConnectArrow(connectArrow, hasInputs, hasOutputs, actualNodeNames);
  }

  // Rename config keys.
  if (inProp) renameConfigKey(inProp, 'inputs');
  if (outProp) renameConfigKey(outProp, 'outputs');

  return true;
}

// ── Driver ──────────────────────────────────────────────────────────────────

function isCircuitCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr) && expr.getText() === 'circuit') return true;
  return false;
}

function processFile(project: Project, filePath: string, issues: SanityIssue[]): TransformResult {
  const source = project.addSourceFileAtPath(filePath);
  let rewrittenCircuits = 0;

  // Pass 1 — sanity check
  source.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && isCircuitCall(node)) {
      const { connectArrow } = readConfig(node);
      if (connectArrow) checkConnectArrow(connectArrow, filePath, issues);
    }
  });
  if (issues.some(i => i.file === filePath)) return { rewrittenCircuits: 0 };

  // Pass 2 — transform
  source.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && isCircuitCall(node)) {
      if (transformCircuitCall(node)) rewrittenCircuits++;
    }
  });

  return { rewrittenCircuits };
}

function main() {
  const files = discoverFiles();
  console.log(`Discovered ${files.length} files containing circuit() calls`);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: false, declaration: false },
  });

  const issues: SanityIssue[] = [];
  let totalRewritten = 0;
  let filesChanged = 0;

  for (const file of files) {
    let result: TransformResult;
    try {
      result = processFile(project, file, issues);
    } catch (e) {
      console.error(`✗ ${file}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (result.rewrittenCircuits > 0) {
      filesChanged++;
      totalRewritten += result.rewrittenCircuits;
      const rel = file.replace(process.cwd() + '/', '');
      console.log(`  ${rel}: ${result.rewrittenCircuits} circuit(s)`);
    }
  }

  if (issues.length > 0) {
    console.error(`\n✗ Sanity check failed (${issues.length} issue(s)):`);
    for (const i of issues) {
      const rel = i.file.replace(process.cwd() + '/', '');
      console.error(`  ${rel}:${i.line}  ${i.reason}`);
    }
    console.error('\nFix these by hand or refine the codemod, then re-run.');
    process.exit(1);
  }

  console.log(`\n${apply ? 'Applied' : 'Would apply'}: ${totalRewritten} circuits across ${filesChanged} files`);

  if (apply) {
    project.saveSync();
    console.log('✓ Wrote changes to disk');
  } else {
    console.log('(dry run; pass --apply to write)');
  }
}

main();
