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

import type { ReactNode } from "react";

export interface TruthTableColumn {
  name: string;
  /** Visually groups columns into "causes" vs "effects" via header tint. */
  group?: "input" | "output";
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
  className?: string;
}

export function TruthTable({
  columns,
  rows,
  title,
  caption,
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
        "rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] overflow-hidden " +
        (className ?? "")
      }
    >
      {title && (
        <div className="border-b border-[var(--embed-border)] px-4 py-3 text-base font-semibold text-[var(--embed-text-primary)]">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ captionSide: "bottom" }}
          aria-label={tableAriaLabel}
        >
          {caption && (
            <caption className="px-4 py-2 text-left text-xs text-[var(--embed-text-muted)]">
              {caption}
            </caption>
          )}
          <thead className="bg-[var(--embed-bg-tertiary)]">
            <tr>
              {columns.map((col, i) => {
                const isLastInput =
                  col.group === "input" &&
                  columns[i + 1]?.group === "output";
                const tintForGroup =
                  col.group === "output"
                    ? "bg-[var(--embed-bg-secondary)]"
                    : "";
                return (
                  <th
                    key={col.name + i}
                    scope="col"
                    className={
                      "px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--embed-text-secondary)] " +
                      tintForGroup +
                      (isLastInput
                        ? " border-r border-[var(--embed-border)]"
                        : "")
                    }
                  >
                    {col.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-t border-[var(--embed-border)]/40"
              >
                {row.map((cell, ci) => {
                  const col = columns[ci];
                  const isLastInput =
                    col.group === "input" &&
                    columns[ci + 1]?.group === "output";
                  return (
                    <td
                      key={ci}
                      className={
                        "px-3 py-1.5 font-mono text-sm text-[var(--embed-text-primary)]" +
                        (isLastInput
                          ? " border-r border-[var(--embed-border)]"
                          : "")
                      }
                    >
                      {renderCell(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value: string | number): ReactNode {
  return value;
}
