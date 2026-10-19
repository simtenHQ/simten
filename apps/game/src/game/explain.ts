/**
 * Why a submit didn't pass, in a sentence.
 *
 * Every failure gets one. A wrong output also reddens its column in the spec
 * table, but a red column on its own left newcomers asking what was wrong. The
 * others have nothing to redden: the circuit is missing, misnamed, uses a gate
 * the level forbids, or never ran. Those used to submit in silence, which read
 * as a broken button.
 *
 * Everything here comes off the failure itself. Backticked names render as
 * chips in the panel; the wrong-output sentence leaves them out, since it sits
 * beside the table that already names the signals.
 */

import type { GradeResult, Level } from './types';

export function explain(result: GradeResult | null, level: Level): string | null {
  if (!result) return null;
  // The compiler prefixes validation errors with the circuit's name; the player
  // only needs what follows.
  if (result.status === 'error') {
    return result.message.replace(/^Circuit '[^']*' validation failed:\s*-?\s*/, '');
  }
  if (result.status !== 'fail') return null;

  const f = result.failure;
  switch (f.kind) {
    case 'vector': {
      const inputs = Object.entries(f.vector.inputs)
        .map(([name, value]) => `${name} = ${value}`)
        .join(', ');
      const wrong = Object.entries(f.vector.expect)
        .filter(([port, want]) => f.actual[port] !== want)
        .map(([port, want]) => `${port} should be ${want} but your circuit gives ${f.actual[port]}`)
        .join(', and ');
      // On a sequential level the step is what tells two identical rows apart.
      if (level.sequential) {
        // A labelled step (the CPU's instructions) says what ran, not its bits.
        const step = level.labels?.[f.index] ?? inputs;
        return step
          ? `At step ${f.index + 1} (${step}), ${wrong}.`
          : `At step ${f.index + 1}, ${wrong}.`;
      }
      return inputs ? `With ${inputs}, ${wrong}.` : `${wrong[0].toUpperCase()}${wrong.slice(1)}.`;
    }
    case 'missing-circuit':
      return f.found.length > 0
        ? `No circuit called \`${f.expected}\`. This file defines: ${f.found.join(', ')}.`
        : `No circuit called \`${f.expected}\`. Nothing is exported yet.`;
    case 'interface':
      return `This circuit has ${f.problems.join(', and ')}.`;
    case 'forbidden': {
      const plural = f.used.length > 1;
      return `${f.used.join(', ')} ${plural ? 'are' : 'is'} not allowed on this level. You have: ${f.allowed.join(', ')}.`;
    }
  }
}
