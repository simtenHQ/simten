/**
 * Presentational truth-table component for /learn pages.
 *
 * Takes column metadata and a positional row matrix; renders a styled,
 * accessible <table> in a card that matches the CircuitEmbed aesthetic
 * (theme tokens from packages/embed/src/styles/embed.css). No simulator
 * coupling — data is hand-coded at the call site.
 *
 * Plan: ~/.claude/plans/yeah-lets-mae-a-crystalline-cookie.md
 */

import type { ReactNode } from 'react';
import { type PortValuesMap, readPortBit } from '@/lib/port-values';

// Reusing the embed CSS variables (light/dark theming via --embed-*).

export interface TruthTableColumn {
  name: string;
  /** Visually groups columns into "causes" vs "effects" via header tint. */
  group?: 'input' | 'output';
}

export interface TruthTableProps {
  columns: TruthTableColumn[];
  /**
   * Positional rows: each row's length must equal `columns.length`. The
   * runtime guard below throws a descriptive error if not, caught on
   * first render at dev time.
   */
  rows: Array<Array<string | number>>;
  /** Optional header band above the table. Not the accessible name. */
  title?: string;
  /**
   * Optional small text below the table — renders as a real <caption>
   * element for screen readers, positioned at the bottom via CSS.
   */
  caption?: string;
  /**
   * Index of the row to visually highlight (e.g. "the input combination
   * the canvas is currently showing"). The caller computes which row to
   * highlight from whatever state they're tracking.
   */
  highlightRow?: number;
  className?: string;
}

export function TruthTable({
  columns,
  rows,
  title,
  caption,
  highlightRow,
  className,
}: TruthTableProps) {
  // Runtime guard: every row must have one cell per declared column.
  // Bounded cost (4–8 rows in practice), buys ergonomic positional rows
  // without giving up the safety net.
  rows.forEach((row, i) => {
    if (row.length !== columns.length) {
      throw new Error(
        `TruthTable: row ${i} has ${row.length} cells but ${columns.length} columns are declared. ` +
          `Either fix the row or update the columns array.`,
      );
    }
  });

  // If caption isn't provided but title is, the table still needs an
  // accessible name. ARIA-label as the fallback.
  const tableAriaLabel = !caption && title ? title : undefined;

  return (
    <div
      className={
        'rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] overflow-hidden ' +
        (className ?? '')
      }
    >
      {title && (
        <div className="border-b border-[var(--embed-border)] px-4 py-3 text-base font-semibold text-[var(--embed-text-primary)]">
          {title}
        </div>
      )}
      <div className="overflow-x-auto px-4 py-4 flex justify-center">
        <table
          className="border-collapse text-center"
          style={{ captionSide: 'bottom' }}
          aria-label={tableAriaLabel}
        >
          {caption && (
            <caption className="pt-3 text-center text-xs text-[var(--embed-text-muted)]">
              {caption}
            </caption>
          )}
          <thead>
            <tr>
              {columns.map((col, i) => {
                const isLastInput = col.group === 'input' && columns[i + 1]?.group === 'output';
                return (
                  <th
                    key={col.name + i}
                    scope="col"
                    className={
                      'px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--embed-text-secondary)]' +
                      (isLastInput ? ' border-r border-[var(--embed-border)]' : '')
                    }
                  >
                    {col.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isHighlighted = ri === highlightRow;
              return (
                <tr
                  key={ri}
                  className={
                    isHighlighted ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/40' : ''
                  }
                  aria-current={isHighlighted ? 'true' : undefined}
                >
                  {row.map((cell, ci) => {
                    const col = columns[ci];
                    const isLastInput =
                      col.group === 'input' && columns[ci + 1]?.group === 'output';
                    return (
                      <td
                        key={ci}
                        className={
                          'px-4 py-1.5 font-mono text-sm' +
                          (isLastInput ? ' border-r border-[var(--embed-border)]' : '')
                        }
                      >
                        <BitCell value={cell} active={col.group === 'output'} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Render a single truth-table cell. For 0/1 bit values we style the "1"
 * as a tinted badge — output 1s use a brighter accent so the pattern of
 * which inputs produce a 1 at each output reads at a glance. 0s are
 * dimmed so the active cells stand out instead of every cell carrying
 * equal weight.
 */
function BitCell({ value, active }: { value: string | number; active: boolean }): ReactNode {
  if (value === 1 || value === '1') {
    return (
      <span
        className={
          'inline-flex h-6 w-6 items-center justify-center rounded font-semibold ' +
          (active
            ? 'bg-blue-500/20 text-blue-300 ring-1 ring-inset ring-blue-500/40'
            : 'bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-primary)]')
        }
      >
        1
      </span>
    );
  }
  if (value === 0 || value === '0') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center text-[var(--embed-text-muted)]">
        0
      </span>
    );
  }
  // Non-binary cell (string label, multi-bit value) — render plain.
  return <span className="text-[var(--embed-text-primary)]">{value}</span>;
}

/**
 * Given the live port-values map from a simulator and the columns + rows
 * of a truth table, find the index of the row whose input cells match
 * the simulator's current input port values. Returns `undefined` when no
 * match exists (or when the sim isn't ready yet).
 *
 * Uses value-matching rather than positional bit-packing, so:
 *   - rows can be declared in any order
 *   - rows can be omitted (e.g., for pedagogical simplification)
 *   - no hidden "first input is MSB" invariant for a future author to violate
 *
 * Linear scan over rows × inputs, which is free at any realistic table
 * size (worst practical case ~16 × 5 = 80 comparisons).
 */
export function computeActiveRow(
  portValues: PortValuesMap | null | undefined,
  columns: TruthTableColumn[],
  rows: Array<Array<number | string>>,
): number | undefined {
  if (!portValues || portValues.size === 0) return undefined;

  const inputCols = columns
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => col.group === 'input');

  // Walk the inputs imperatively so currentBits narrows to number[] via
  // control flow — .some() doesn't propagate the null-narrowing.
  const currentBits: number[] = [];
  for (const { col } of inputCols) {
    const bit = readPortBit(portValues, col.name);
    if (bit === null) return undefined;
    currentBits.push(bit);
  }

  const found = rows.findIndex((row) => inputCols.every(({ i }, k) => row[i] === currentBits[k]));
  return found === -1 ? undefined : found;
}
