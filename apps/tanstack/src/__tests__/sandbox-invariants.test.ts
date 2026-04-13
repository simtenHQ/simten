/**
 * Sandbox invariant tests
 *
 * Verifies that no code in the main app frame calls new Function() directly.
 * All arbitrary JS execution must go through the sandbox (iframe + Web Worker).
 *
 * new Function() is the underlying primitive used by executeCircuitCode and
 * executeJsCode — banning it here covers both and any future variants.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const APP_SRC = join(__dirname, '..');

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
      files.push(...collectSourceFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

// Patterns that execute arbitrary JS — all must go through the sandbox
const BANNED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /new Function\(/,
    reason: 'new Function() executes arbitrary JS directly in the main frame',
  },
  {
    pattern: /import[^'"]*\b(executeCircuitCode|executeJsCode)\b/,
    reason: 'executeCircuitCode/executeJsCode call new Function() — use sandbox.compile() instead',
  },
];

describe('sandbox invariants', () => {
  const files = collectSourceFiles(APP_SRC);

  for (const { pattern, reason } of BANNED) {
    it(`no source file matches: ${pattern}`, () => {
      const violations: string[] = [];

      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          const trimmed = line.trimStart();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          if (pattern.test(line)) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      }

      if (violations.length > 0) {
        throw new Error(`${reason}\n\n${violations.join('\n')}`);
      }
    });
  }
});
