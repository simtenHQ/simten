/**
 * The level's truth table, laid out horizontally.
 *
 * Signals run down the left and each vector is a column — the transpose of how
 * a truth table is usually written. It suits where this now lives, a wide and
 * short sheet, where the conventional layout would be a tall narrow strip with
 * dead space either side.
 *
 * Nothing is hidden. These are the exact vectors the grader runs, so the
 * puzzle is "build this", never "guess what it wants".
 *
 * On a solve it doubles as the scoreboard for the victory run: the column
 * being driven through the circuit is highlighted, and proven columns tick off
 * above.
 */

import type { Level } from '../game/types';

interface TruthTableProps {
  level: Level;
  /** Vector currently being driven through the circuit, if a run is going. */
  active?: number | null;
  /** How many vectors have been proven so far. */
  proven?: number;
}

/**
 * Signal names, as their own function so the table's read of the level shape
 * is testable without a DOM.
 *
 * `level.inputs` is a list of signal names. It used to be a map, and this was
 * `Object.keys(level.inputs)` — which on an array returns its indices, so the
 * table silently rendered headers `0`, `1` and then looked up `v.inputs['0']`
 * for every cell and found nothing. `Object.keys` on an array is legal
 * TypeScript, so nothing failed; the table just went blank.
 */
export function columnsFor(level: Level): { inputNames: string[]; outputNames: string[] } {
  return { inputNames: level.inputs, outputNames: level.outputs };
}

export function TruthTable({ level, active = null, proven = 0 }: TruthTableProps) {
  const { inputNames, outputNames } = columnsFor(level);

  const cell = (i: number) =>
    [
      'w-7 py-0.5 text-center transition-colors duration-200',
      active === i ? 'bg-emerald-500/15' : '',
    ].join(' ');

  return (
    <table className="font-mono text-sm tabular-nums">
      <tbody>
        <tr>
          <td className="pr-3" />
          {level.vectors.map((v, i) => (
            <td key={JSON.stringify(v.inputs)} className={`${cell(i)} h-5 text-emerald-500`}>
              <span
                className={`inline-block transition-all duration-200 ${
                  i < proven ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
              >
                ✓
              </span>
            </td>
          ))}
        </tr>

        {inputNames.map((name) => (
          <tr key={name}>
            <th className="pr-3 text-right font-medium text-muted-foreground">{name}</th>
            {level.vectors.map((v, i) => (
              <td key={JSON.stringify(v.inputs)} className={cell(i)}>
                {v.inputs[name]}
              </td>
            ))}
          </tr>
        ))}

        {outputNames.map((name) => (
          <tr key={name} className="border-t border-border">
            <th className="pr-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
              {name}
            </th>
            {level.vectors.map((v, i) => (
              <td
                key={JSON.stringify(v.inputs)}
                className={`${cell(i)} text-emerald-600 dark:text-emerald-400`}
              >
                {v.expect[name]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
