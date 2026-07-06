/**
 * Three formatters for parsed VCD signal traces: `changes`, `raw`, `edges`.
 *
 * All produce a `FormattedSignal` carrying:
 *   - `initial`: window-start carry-in (cycle, value, stable_since, optional value_hex)
 *   - `trace`: shape varies by format (positional pairs/triples or compact strings)
 *   - optional `truncated` / `truncation_hint` / `warning`
 *
 * Output caps (per plan):
 *   - `changes` / `edges`: per-signal cap on returned transitions (default 200)
 *   - `raw`: total cap of 20 000 cells across all signals
 *
 * Carry-in: latest transition at-or-before `cycleTimes[from]`. If no prior
 * transition exists, value is `'x'.repeat(width)` and `stable_since === 0`.
 *
 * Clock-on-changes warning: when a requested signal IS the detected clock AND
 * format === 'changes', attach a warning (don't error).
 */

import type { CycleMap } from './vcd-cycles.js';
import type { ParsedVcd, ResolvedSignal, VcdChange } from './vcd-parser.js';

export type FormatKind = 'changes' | 'raw' | 'edges';
export type EdgeKind = 'rising' | 'falling' | 'any';

export interface FormatOptions {
  format: FormatKind;
  cycleRange: [number, number];
  edge?: EdgeKind;
  /** Per-signal cap for changes/edges. Default 200. */
  perSignalCap?: number;
  /** Total cells (cycles × signals) cap for raw. Default 20 000. */
  rawCellCap?: number;
  /** When set, requesting this signal id with format='changes' triggers the clock-on-changes warning. */
  clockId?: string;
}

export interface InitialValue {
  cycle: number;
  value: string;
  value_hex?: string;
  stable_since: number;
}

export interface FormattedSignal {
  requested: string;
  resolved: string;
  width: number;
  initial: InitialValue;
  trace:
    | Array<[cycle: number, value: string]> // changes
    | { start_cycle: number; values: string | string[] } // raw
    | Array<[cycle: number, from: string, to: string]>; // edges
  values_hex?: string[];
  truncated?: true;
  truncation_hint?: string;
  warning?: string;
}

const TRUNCATION_HINT = 'narrow cycle_range or request fewer signals';
const CLOCK_ON_CHANGES_WARNING =
  'querying the clock with format=changes is degenerate; use format=edges or raw';

/**
 * Find the latest VcdChange at-or-before time `t`.
 * Returns the index in the array, or -1 if all changes are after t.
 */
function lastChangeAtOrBefore(changes: VcdChange[], t: number): number {
  if (changes.length === 0 || changes[0].time > t) return -1;
  let lo = 0;
  let hi = changes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (changes[mid].time <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Convert a binary string to hex when all bits are definite (0/1).
 * Returns undefined if any bit is x or z.
 */
function binToHex(bin: string): string | undefined {
  for (const c of bin) {
    if (c !== '0' && c !== '1') return undefined;
  }
  if (bin.length === 0) return '';
  // parseInt handles up to 32 bits; for wider buses we fall back to chunked.
  if (bin.length <= 30) {
    return parseInt(bin, 2)
      .toString(16)
      .padStart(Math.ceil(bin.length / 4), '0');
  }
  // Chunk by 4 bits from the right, then assemble.
  const pad = bin.length % 4;
  const head = pad === 0 ? '' : bin.slice(0, pad);
  let out = '';
  if (head) out += parseInt(head, 2).toString(16);
  for (let i = pad; i < bin.length; i += 4) {
    out += parseInt(bin.slice(i, i + 4), 2).toString(16);
  }
  return out;
}

function uninitializedValue(width: number): string {
  return width === 1 ? 'x' : 'x'.repeat(width);
}

interface CarryIn {
  value: string;
  stable_since: number;
}

function computeCarryIn(
  changes: VcdChange[],
  cycleMap: CycleMap,
  fromCycle: number,
  width: number,
): CarryIn {
  const tStart = cycleMap.timeAtCycle(fromCycle);
  const idx = lastChangeAtOrBefore(changes, tStart);
  if (idx < 0) {
    return { value: uninitializedValue(width), stable_since: 0 };
  }
  const ch = changes[idx];
  // stable_since: cycle of that prior transition. cycleAtTime returns -1 for
  // transitions before cycle 0 (e.g. dumpvars at t=0); the plan says
  // stable_since=0 in that case.
  const c = cycleMap.cycleAtTime(ch.time);
  return { value: ch.value, stable_since: c < 0 ? 0 : c };
}

function buildInitial(
  changes: VcdChange[],
  cycleMap: CycleMap,
  fromCycle: number,
  width: number,
): InitialValue {
  const carry = computeCarryIn(changes, cycleMap, fromCycle, width);
  const initial: InitialValue = {
    cycle: fromCycle,
    value: carry.value,
    stable_since: carry.stable_since,
  };
  if (width > 4) {
    const hex = binToHex(carry.value);
    if (hex !== undefined) initial.value_hex = hex;
  }
  return initial;
}

/** Format a single signal in `changes` mode. */
function formatChanges(
  changes: VcdChange[],
  cycleMap: CycleMap,
  range: [number, number],
  cap: number,
): { trace: Array<[number, string]>; truncated: boolean } {
  const [from, to] = range;
  const tStart = cycleMap.timeAtCycle(from);
  const tEnd = cycleMap.timeAtCycle(to);
  const trace: Array<[number, string]> = [];
  let truncated = false;
  for (const ch of changes) {
    if (ch.time <= tStart) continue;
    if (ch.time > tEnd) break;
    if (trace.length >= cap) {
      truncated = true;
      break;
    }
    const c = cycleMap.cycleAtTime(ch.time);
    trace.push([c < 0 ? from : c, ch.value]);
  }
  return { trace, truncated };
}

/** Format a single signal in `edges` mode with edge-kind filtering. */
function formatEdges(
  changes: VcdChange[],
  cycleMap: CycleMap,
  range: [number, number],
  cap: number,
  edge: EdgeKind,
  width: number,
  startValue: string,
): { trace: Array<[number, string, string]>; truncated: boolean; warning?: string } {
  const [from, to] = range;
  const tStart = cycleMap.timeAtCycle(from);
  const tEnd = cycleMap.timeAtCycle(to);
  const trace: Array<[number, string, string]> = [];
  let truncated = false;
  let prev = startValue;
  let warning: string | undefined;

  // For multi-bit signals, rising/falling are ill-defined. Plan-aligned v1
  // behavior: warn and treat as `any` so the user still gets data.
  let effectiveEdge = edge;
  if (width > 1 && (edge === 'rising' || edge === 'falling')) {
    warning = `edge='${edge}' is only meaningful for 1-bit signals; returning all transitions`;
    effectiveEdge = 'any';
  }

  for (const ch of changes) {
    if (ch.time <= tStart) {
      prev = ch.value;
      continue;
    }
    if (ch.time > tEnd) break;
    const next = ch.value;
    let keep = false;
    if (effectiveEdge === 'any') {
      keep = next !== prev;
    } else if (effectiveEdge === 'rising') {
      // 0 or x → 1
      keep = next === '1' && prev !== '1';
    } else {
      // falling: 1 or x → 0
      keep = next === '0' && prev !== '0';
    }
    if (keep) {
      if (trace.length >= cap) {
        truncated = true;
        break;
      }
      const c = cycleMap.cycleAtTime(ch.time);
      trace.push([c < 0 ? from : c, prev, next]);
    }
    prev = next;
  }
  return { trace, truncated, ...(warning ? { warning } : {}) };
}

/** Build a value-at-cycle array for one signal across [from, to]. */
function buildRawValues(
  changes: VcdChange[],
  cycleMap: CycleMap,
  range: [number, number],
  width: number,
): string[] {
  const [from, to] = range;
  const values: string[] = [];
  // Walk cycles, advancing a pointer into changes[] as we go.
  const idx = lastChangeAtOrBefore(changes, cycleMap.timeAtCycle(from));
  let current = idx < 0 ? uninitializedValue(width) : changes[idx].value;
  // Index of the next change yet to be applied.
  let nextIdx = idx + 1;
  for (let c = from; c <= to; c++) {
    const tCycle = cycleMap.timeAtCycle(c);
    while (nextIdx < changes.length && changes[nextIdx].time <= tCycle) {
      current = changes[nextIdx].value;
      nextIdx++;
    }
    values.push(current);
  }
  return values;
}

export interface FormatResult {
  signals: FormattedSignal[];
  /** Cycle range actually returned (may be narrowed from the request when raw caps truncate). */
  effectiveRange: [number, number];
}

/**
 * Format resolved signals over a cycle window into the requested shape.
 * Caller is responsible for sanity-guarding `cycleRange` size before calling
 * (the tool wrapper does this; see plan §4).
 */
export function formatSignals(
  parsed: ParsedVcd,
  cycleMap: CycleMap,
  resolved: ResolvedSignal[],
  options: FormatOptions,
): FormatResult {
  const { format, cycleRange } = options;
  const perSignalCap = options.perSignalCap ?? 200;
  const rawCellCap = options.rawCellCap ?? 20_000;
  const edge: EdgeKind = options.edge ?? 'rising';
  const clockId = options.clockId;

  // For raw, we may need to narrow the window to fit the cell cap.
  let [from, to] = cycleRange;
  let rawTruncated = false;
  if (format === 'raw' && resolved.length > 0) {
    const requestedCells = (to - from + 1) * resolved.length;
    if (requestedCells > rawCellCap) {
      const maxCycles = Math.floor(rawCellCap / resolved.length);
      to = from + Math.max(0, maxCycles - 1);
      rawTruncated = true;
    }
  }

  const out: FormattedSignal[] = [];

  for (const r of resolved) {
    const sig = r.resolved;
    const changes = parsed.changes.get(sig.id) ?? [];
    const initial = buildInitial(changes, cycleMap, from, sig.width);

    const formatted: FormattedSignal = {
      requested: r.requested,
      resolved: sig.fullPath,
      width: sig.width,
      initial,
      trace: [], // overwritten below per-format
    };

    if (sig.unsupported) {
      formatted.warning = `value type "${sig.unsupported}" not supported in v1`;
      formatted.trace =
        format === 'raw' ? { start_cycle: from, values: sig.width === 1 ? '' : [] } : [];
      out.push(formatted);
      continue;
    }

    if (format === 'changes') {
      if (clockId !== undefined && sig.id === clockId) {
        formatted.warning = CLOCK_ON_CHANGES_WARNING;
      }
      const { trace, truncated } = formatChanges(changes, cycleMap, [from, to], perSignalCap);
      formatted.trace = trace;
      if (truncated) {
        formatted.truncated = true;
        formatted.truncation_hint = TRUNCATION_HINT;
      }
    } else if (format === 'edges') {
      const { trace, truncated, warning } = formatEdges(
        changes,
        cycleMap,
        [from, to],
        perSignalCap,
        edge,
        sig.width,
        initial.value,
      );
      formatted.trace = trace;
      if (truncated) {
        formatted.truncated = true;
        formatted.truncation_hint = TRUNCATION_HINT;
      }
      if (warning) formatted.warning = warning;
    } else {
      // raw
      const values = buildRawValues(changes, cycleMap, [from, to], sig.width);
      if (sig.width === 1) {
        formatted.trace = { start_cycle: from, values: values.join('') };
      } else {
        formatted.trace = { start_cycle: from, values };
        if (sig.width > 4) {
          formatted.values_hex = values.map((v) => binToHex(v) as string | undefined) as string[];
        }
      }
      if (rawTruncated) {
        formatted.truncated = true;
        formatted.truncation_hint = TRUNCATION_HINT;
      }
    }

    out.push(formatted);
  }

  return { signals: out, effectiveRange: [from, to] };
}
