/**
 * The level's vectors, laid out horizontally.
 *
 * Signals run down the left and each vector is a column — the transpose of how
 * a truth table is usually written. It suits where this now lives, a wide and
 * short sheet, where the conventional layout would be a tall narrow strip with
 * dead space either side.
 *
 * The transpose also means a sequential level needs almost nothing extra: left
 * to right is already how a timing diagram reads, so `level.sequential` adds a
 * row of step numbers and the same table becomes a sequence.
 *
 * Nothing is hidden. These are the exact vectors the grader runs, so the
 * puzzle is "build this", never "guess what it wants".
 *
 * It doubles as the scoreboard. The column being driven through the circuit is
 * highlighted, columns already shown correct go green, and a failing column
 * goes red. The colour lands on the numbers themselves rather than on a row of
 * ticks above them — one less row to align against, and the verdict reads on
 * the thing it is a verdict about.
 */

import type { Level } from '../game/types';

interface TruthTableProps {
  level: Level;
  /** Vector currently being driven through the circuit, if a run is going. */
  active?: number | null;
  /** How many vectors are known correct, counting from the left. */
  proven?: number;
  /**
   * The vector that failed, if one did.
   *
   * The grader stops at the first wrong row, so everything left of this is
   * known good and everything right of it is simply untested — which is why
   * only this one column goes red.
   */
  failed?: number | null;
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

export function TruthTable({ level, active = null, proven = 0, failed = null }: TruthTableProps) {
  const { inputNames, outputNames } = columnsFor(level);

  const cell = (i: number) => {
    const verdict = failed === i ? 'bg-red-500/15' : i < proven ? 'bg-emerald-500/15' : '';
    return [
      'w-7 py-0.5 text-center transition-colors duration-200',
      // The sweep's highlight wins while it is passing over a column, so the
      // eye follows the run rather than the accumulating result behind it.
      active === i ? 'bg-emerald-500/25' : verdict,
    ].join(' ');
  };

  return (
    <table className="font-mono text-sm tabular-nums">
      <tbody>
        {/* Step numbers, on a sequential level only.
            Without them the columns read as an unordered set of cases, which is
            what a truth table is and what a sequence is not. They are also what
            makes the lesson visible: on a latch two steps carry identical
            inputs and different outputs, and you can point at them. */}
        {level.sequential && (
          <tr className="border-b border-border">
            <th className="pr-3 text-right text-xs font-normal text-muted-foreground">step</th>
            {level.vectors.map((_, i) => (
              // Position is the identity here: these are ordered steps, and two
              // of them can carry byte-identical inputs.
              // biome-ignore lint/suspicious/noArrayIndexKey: the index is the step
              <td key={i} className="w-7 py-0.5 text-center text-xs text-muted-foreground">
                {i + 1}
              </td>
            ))}
          </tr>
        )}

        {inputNames.map((name) => (
          <tr key={name}>
            <th className="pr-3 text-right font-medium text-muted-foreground">{name}</th>
            {level.vectors.map((v, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: see the step row
              <td key={i} className={cell(i)}>
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
              // biome-ignore lint/suspicious/noArrayIndexKey: see the step row
              <td key={i} className={`${cell(i)} text-emerald-600 dark:text-emerald-400`}>
                {v.expect[name]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
