/**
 * What the player sees after pressing Submit.
 *
 * Every failure says what is wrong and, where there is one, the specific input
 * that broke it. A bare "incorrect" would be the difference between a puzzle
 * and a guessing game.
 */

import type { GradeResult, Level } from '../game/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 font-mono text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  );
}

const fmt = (values: Record<string, number>) =>
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

export function GradeReport({
  result,
  level,
  revealed = true,
}: {
  result: GradeResult;
  level: Level;
  /**
   * Hold the solved panel back until the victory run has finished driving the
   * truth table. Announcing the score while the circuit is still proving itself
   * steps on the moment.
   */
  revealed?: boolean;
}) {
  if (result.status === 'pass') {
    if (!revealed) return null;
    const par = level.par;
    const beatPar = par !== undefined && result.gates <= par;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 duration-500">
        <div className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Solved
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-semibold tabular-nums">{result.gates}</span>
          <span className="text-sm text-muted-foreground">
            {result.gates === 1 ? 'gate' : 'gates'}
          </span>
        </div>
        {par !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            {beatPar ? `par ${par} — nothing wasted` : `par is ${par}; there is a smaller answer`}
          </div>
        )}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
        <div className="font-semibold text-amber-600 dark:text-amber-400">Did not compile</div>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{result.message}</pre>
      </div>
    );
  }

  const f = result.failure;
  return (
    <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-4">
      {f.kind === 'missing-circuit' && (
        <>
          <div className="font-semibold text-rose-600 dark:text-rose-400">
            No circuit named {f.expected}
          </div>
          <div className="mt-1 text-sm">
            {f.found.length > 0
              ? `Found ${f.found.map((n) => `\`${n}\``).join(', ')}. The name has to match exactly.`
              : 'The source does not define any circuit yet.'}
          </div>
        </>
      )}

      {f.kind === 'interface' && (
        <>
          <div className="font-semibold text-rose-600 dark:text-rose-400">
            The ports do not match
          </div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {f.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      )}

      {f.kind === 'forbidden' && (
        <>
          <div className="font-semibold text-rose-600 dark:text-rose-400">
            {f.used.length === 1
              ? 'That gate is not available here'
              : 'Those gates are not available here'}
          </div>
          <div className="mt-1 text-sm">
            Used {f.used.join(', ')}. This level allows only {f.allowed.join(', ')}.
          </div>
        </>
      )}

      {f.kind === 'vector' && (
        <>
          <div className="font-semibold text-rose-600 dark:text-rose-400">Wrong for one input</div>
          <div className="mt-2 space-y-1">
            <Row label="given" value={fmt(f.vector.inputs)} />
            <Row label="expected" value={fmt(f.vector.expect)} />
            <Row label="got" value={fmt(f.actual)} />
          </div>
        </>
      )}
    </div>
  );
}
