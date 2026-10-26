/**
 * Circuit samples in the docs and blog compile as the sandbox runs them.
 *
 * Readers paste these into the editor and save them, so they name the same
 * components and ports a share link does. A rename on the frozen surface
 * (decision 0003) that breaks one breaks every copy of it.
 *
 * A sample is any ts/tsx block that calls `circuit('Name', …)`, minus
 * illustrations with a `...` placeholder. A sample that builds on a circuit
 * defined in an earlier block of the same page (FullAdder on HalfAdder) is
 * compiled with that block in front, the way a reader would assemble it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { executeCircuitCode } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';

const CONTENT = join(__dirname, '../../content');

interface Sample {
  where: string;
  code: string;
  defines: string[];
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return mdxFiles(full);
    return e.name.endsWith('.mdx') ? [full] : [];
  });
}

const definedNames = (code: string) =>
  [...code.matchAll(/\bconst\s+(\w+)\s*=\s*circuit\(/g)].map((m) => m[1]);

const FENCE = /^([ \t]*)```[^\n]*\n[\s\S]*?^\1```/gm;
const TS_FENCE = /^([ \t]*)```(?:ts|tsx|typescript)\b[^\n]*\n([\s\S]*?)^\1```/gm;
// A circuit exported from the MDX itself, rendered live by a <CircuitEmbed>.
const MDX_EXPORT = /^export const \w+ = circuit\('[\s\S]*?^\}\)/gm;

function samples(file: string): Sample[] {
  const src = readFileSync(file, 'utf8');
  const lineOf = (index: number) => src.slice(0, index).split('\n').length;
  const found: Array<{ index: number; code: string }> = [];

  for (const m of src.matchAll(TS_FENCE)) {
    // JSX lines (`<CircuitEmbed … />`) render the circuit; they are not part of it.
    const code = m[2]
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('<'))
      .join('\n');
    found.push({ index: m.index, code });
  }
  // Blank out fenced blocks, keeping offsets, so their contents are not read as MDX exports.
  const outsideFences = src.replace(FENCE, (block) => block.replace(/[^\n]/g, ' '));
  for (const m of outsideFences.matchAll(MDX_EXPORT)) found.push({ index: m.index, code: m[0] });

  return found
    .filter(({ code }) => /\bcircuit\('/.test(code) && !code.includes('...'))
    .sort((a, b) => a.index - b.index)
    .map(({ index, code }) => ({
      where: `${relative(CONTENT, file)}:${lineOf(index)}`,
      code,
      defines: definedNames(code),
    }));
}

/** The sample, preceded by the latest earlier sample defining each circuit it uses but lacks. */
function withPrerequisites(sample: Sample, earlier: Sample[]): string {
  const needed: Sample[] = [];
  for (const prior of [...earlier].reverse()) {
    const supplies = prior.defines.filter(
      (n) =>
        !sample.defines.includes(n) &&
        new RegExp(`\\b${n}\\b`).test(sample.code) &&
        !needed.some((s) => s.defines.includes(n)),
    );
    if (supplies.length > 0) needed.unshift(prior);
  }
  return [...needed.map((s) => s.code), sample.code].join('\n');
}

const cases = mdxFiles(CONTENT).flatMap((file) => {
  const all = samples(file);
  return all.map((s, i) => [s.where, withPrerequisites(s, all.slice(0, i))] as const);
});

describe('doc and blog circuit samples compile', () => {
  it('finds samples to check', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('%s', (_where, code) => {
    const result = executeCircuitCode(code);
    expect(result.error).toBeNull();
    expect(result.circuits.length).toBeGreaterThan(0);
  });
});
