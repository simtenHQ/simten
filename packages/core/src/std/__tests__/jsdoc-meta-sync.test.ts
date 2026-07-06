/**
 * Guard for issue #102: every `export const X = circuit(...)` in the stdlib
 * must have leading JSDoc text matching its `meta.description`. The two have
 * different consumers (JSDoc for IDE hover, meta.description for the runtime
 * component picker) and we deliberately keep both. This test ensures they
 * don't drift apart.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STD_DIR = new URL('../', import.meta.url).pathname;

const files = readdirSync(STD_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts');

describe('stdlib JSDoc ↔ meta.description sync', () => {
  for (const file of files) {
    it(`${file}: every circuit() export has JSDoc matching meta.description`, () => {
      const src = readFileSync(join(STD_DIR, file), 'utf8');
      const lines = src.split('\n');
      const mismatches: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const exportMatch = lines[i].match(/^export const (\w+) = circuit\(/);
        if (!exportMatch) continue;
        const name = exportMatch[1];

        // Collect this circuit() block.
        let block = lines[i];
        for (let j = i + 1; j < lines.length; j++) {
          block += '\n' + lines[j];
          if (lines[j].startsWith('});') || lines[j].startsWith(');')) break;
        }
        const descMatch = block.match(/description:\s*'((?:[^'\\]|\\.)*)'/);
        if (!descMatch) continue; // no description => no JSDoc requirement
        const description = descMatch[1];

        // Pull JSDoc directly above (single-line /** ... */ form is what the
        // codemod produces; multi-line is fine too).
        const prev = lines[i - 1] ?? '';
        const singleLine = prev.match(/^\/\*\*\s*(.+?)\s*\*\/$/);
        if (singleLine) {
          if (singleLine[1] !== description) {
            mismatches.push(
              `${name}: JSDoc "${singleLine[1]}" ≠ meta.description "${description}"`,
            );
          }
          continue;
        }
        // Multi-line: scan up for `*/` then `/**`. Just check the description
        // text appears somewhere in the block.
        if (prev.trimEnd().endsWith('*/')) {
          let k = i - 1;
          let jsdoc = '';
          while (k >= 0 && !lines[k].trimStart().startsWith('/**')) {
            jsdoc = lines[k] + '\n' + jsdoc;
            k--;
          }
          jsdoc = (lines[k] ?? '') + '\n' + jsdoc;
          if (!jsdoc.includes(description)) {
            mismatches.push(
              `${name}: multi-line JSDoc does not contain meta.description "${description}"`,
            );
          }
          continue;
        }
        mismatches.push(`${name}: missing JSDoc above export (expected "${description}")`);
      }

      expect(mismatches).toEqual([]);
    });
  }
});
