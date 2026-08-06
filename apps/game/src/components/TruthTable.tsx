/**
 * The level's truth table, shown up front.
 *
 * Nothing is hidden. These are the exact vectors the grader runs, so the
 * puzzle is "build this", never "guess what it wants".
 *
 * On a solve it doubles as the scoreboard for the victory run: the row being
 * driven through the circuit is highlighted, and rows already proven tick off.
 */

import type { Level } from '../game/types';

interface TruthTableProps {
  level: Level;
  /** Row currently being driven through the circuit, if a run is in progress. */
  active?: number | null;
  /** How many rows have been proven so far. */
  proven?: number;
}

export function TruthTable({ level, active = null, proven = 0 }: TruthTableProps) {
  const inputNames = Object.keys(level.inputs);
  const outputNames = Object.keys(level.outputs);

  return (
    <table className="w-full font-mono text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          {inputNames.map((n) => (
            <th key={n} className="py-1 pr-4 font-medium text-muted-foreground">
              {n}
            </th>
          ))}
          {outputNames.map((n) => (
            <th key={n} className="py-1 pr-4 font-medium text-emerald-600 dark:text-emerald-400">
              {n}
            </th>
          ))}
          <th className="w-4" />
        </tr>
      </thead>
      <tbody>
        {level.vectors.map((v, i) => {
          const isActive = active === i;
          const isProven = i < proven;
          return (
            <tr
              key={JSON.stringify(v.inputs)}
              className={[
                'transition-colors duration-200',
                isActive ? 'bg-emerald-500/15' : '',
                !isActive && isProven ? 'text-emerald-600 dark:text-emerald-400' : '',
              ].join(' ')}
            >
              {inputNames.map((n) => (
                <td key={n} className="py-0.5 pr-4">
                  {v.inputs[n]}
                </td>
              ))}
              {outputNames.map((n) => (
                <td key={n} className="py-0.5 pr-4 text-emerald-600 dark:text-emerald-400">
                  {v.expect[n]}
                </td>
              ))}
              <td className="py-0.5 text-emerald-500">
                <span
                  className={`inline-block transition-all duration-200 ${
                    isProven ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                  }`}
                >
                  ✓
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
