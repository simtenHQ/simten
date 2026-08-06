/**
 * Telling the player, immediately, that their circuit is not the one being graded.
 *
 * A level grades a circuit with a specific name — the same contract LeetCode
 * and Codewars use, where the signature is fixed and the body is yours. The
 * problem was never the rule, it was the silence: renaming the circuit emptied
 * the canvas and said nothing until Submit, so the only way to learn the rule
 * was to trip over it.
 *
 * Finding the names is `@simten/core`'s job (`circuitNameSites`, which also
 * backs share-link titles). What counts as wrong is this game's rule, so only
 * that lives here.
 */

import { circuitNameSites } from '@simten/core/circuit';

export interface NameDiagnostic {
  message: string;
  line: number;
  column: number;
  endColumn: number;
  severity: 'warning';
}

/**
 * A warning when nothing in the source carries the name the level grades.
 *
 * Deliberately a warning, not an error: the code is valid and the circuit may
 * be perfectly correct. It just is not the one that will be marked.
 *
 * Silent when the source declares no circuit at all — that is someone
 * mid-keystroke, and nagging them about a name is not help.
 */
export function nameDiagnostics(source: string, target: string): NameDiagnostic[] {
  const sites = circuitNameSites(source);
  if (sites.length === 0) return [];
  if (sites.some((s) => s.name === target)) return [];

  const found = sites.map((s) => s.name).join(', ');
  return sites.map((s) => ({
    message:
      `This level grades a circuit called \`${target}\`, and this one is called \`${s.name}\`. ` +
      `Rename it to \`${target}\` — the rest is yours. (Found: ${found}.)`,
    line: s.line,
    column: s.column,
    endColumn: s.endColumn,
    severity: 'warning' as const,
  }));
}
