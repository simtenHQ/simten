/**
 * Single-pass streaming VCD parser.
 *
 * Header phase: declarations until $enddefinitions. Builds signal map
 * (byFullPath + byLeaf) and resolves requested signals to a retained-id set.
 *
 * Body phase: streams value-change records once. For every record, if its id
 * is in the retained set, append (time, value) to that signal's change array;
 * otherwise skip.
 *
 * Tolerates `r…` (real) and `s…` (string) records — parses the syntax so they
 * don't break the body walk, but those signals are flagged unsupported and
 * their value records are dropped (with a one-time warning per type).
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface SignalInfo {
  id: string;
  fullPath: string;
  leaf: string;
  width: number;
  type: 'wire' | 'reg' | 'integer' | 'real' | 'string' | 'time' | 'parameter' | 'other';
  unsupported?: 'real' | 'string';
}

export interface VcdChange {
  time: number;
  value: string;
}

export interface ResolvedSignal {
  requested: string;
  resolved: SignalInfo;
}

export type ResolutionError =
  | { type: 'ambiguous_signal'; requested: string; candidates: string[] }
  | { type: 'unknown_signal'; requested: string; suggestions: string[] };

export interface ParsedVcd {
  timescalePs: number;
  signals: SignalInfo[];
  byFullPath: Map<string, SignalInfo[]>;
  byLeaf: Map<string, SignalInfo[]>;
  changes: Map<string, VcdChange[]>;
  resolved: ResolvedSignal[];
  resolutionErrors: ResolutionError[];
  warnings: string[];
}

export interface ParseOptions {
  requestedSignals?: string[];
  /**
   * When `requestedSignals` is set, also retain the auto-detected clock so
   * downstream cycle indexing works. Pass an explicit signal name/path to
   * override auto-detection. Defaults to true (auto-detect) — the plan's
   * retained-id set is `{ clock_id, ...requested_signal_ids }`.
   */
  autoIncludeClock?: boolean | string;
  /** Test hook: called for every body-phase value-change record. Used to assert single-pass selectivity. */
  onBodyRecord?: (id: string, retained: boolean) => void;
}

const TIMESCALE_UNITS: Record<string, number> = {
  fs: 1 / 1000,
  ps: 1,
  ns: 1000,
  us: 1_000_000,
  ms: 1_000_000_000,
  s: 1_000_000_000_000,
};

function parseTimescale(text: string): number {
  // Examples: "1ps", "10 ns", "100ps". May have multi-line whitespace.
  const compact = text.replace(/\s+/g, '');
  const m = compact.match(/^(\d+)([a-zA-Z]+)$/);
  if (!m) throw new Error(`Invalid timescale: ${text}`);
  const value = parseInt(m[1], 10);
  const unit = TIMESCALE_UNITS[m[2].toLowerCase()];
  if (unit === undefined) throw new Error(`Unknown timescale unit: ${m[2]}`);
  return value * unit;
}

const VAR_TYPES = new Set([
  'wire', 'reg', 'integer', 'real', 'string', 'time', 'parameter',
  'realtime', 'supply0', 'supply1', 'tri', 'triand', 'trior', 'trireg',
  'tri0', 'tri1', 'wand', 'wor', 'event',
]);

function classifyVarType(t: string): SignalInfo['type'] {
  if (t === 'wire' || t === 'reg' || t === 'integer' || t === 'real' || t === 'string' || t === 'time' || t === 'parameter') {
    return t;
  }
  return 'other';
}

/**
 * Pad a bus value to `width` per IEEE 1364: leading zeros extend with '0',
 * leading 'x' extends with 'x', leading 'z' extends with 'z'.
 */
function padBusValue(bits: string, width: number): string {
  if (bits.length >= width) return bits.slice(-width);
  const lead = bits[0];
  const padChar = lead === 'x' || lead === 'X' ? 'x' : lead === 'z' || lead === 'Z' ? 'z' : '0';
  return padChar.repeat(width - bits.length) + bits;
}

/** Normalize a value char/string to lowercase x/z. */
function normalizeBits(s: string): string {
  return s.replace(/X/g, 'x').replace(/Z/g, 'z');
}

export async function parseVcd(filePath: string, opts: ParseOptions = {}): Promise<ParsedVcd> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const signals: SignalInfo[] = [];
  const byId = new Map<string, SignalInfo>();
  const byFullPath = new Map<string, SignalInfo[]>();
  const byLeaf = new Map<string, SignalInfo[]>();
  const warnings: string[] = [];
  const changes = new Map<string, VcdChange[]>();
  const scopeStack: string[] = [];

  let timescalePs = 1;
  let inHeader = true;
  let currentTime = 0;
  let retainedIds: Set<string> | null = null; // null = retain all
  let resolved: ResolvedSignal[] = [];
  let resolutionErrors: ResolutionError[] = [];
  let warnedReal = false;
  let warnedString = false;

  // Multi-line directive accumulator (used for $timescale, $comment, $var, etc.
  // that may span lines). The VCD spec says any directive is terminated by `$end`.
  let directive: string | null = null;
  let directiveBuf: string[] = [];
  // $dumpvars / $dumpall / $dumpon wrap value-change records — those records
  // must be processed normally, not buffered as directive body. We track the
  // open block so the closing $end pops it without reinterpretation.
  const VALUE_BLOCK = new Set(['dumpvars', 'dumpall', 'dumpon']);
  let valueBlock: string | null = null;

  function finishHeaderIfNeeded(): void {
    if (!inHeader) return;
    inHeader = false;
    // Resolve requested signals now that the header is fully parsed.
    if (opts.requestedSignals) {
      const result = resolveSignalsInternal(opts.requestedSignals, byFullPath, byLeaf, signals);
      resolved = result.resolved;
      resolutionErrors = result.errors;
      const ids = new Set(result.resolved.map((r) => r.resolved.id));
      // Per plan: retained = { clock_id, ...requested_signal_ids }. Without
      // the clock, downstream cycle indexing has no rising edges to count.
      const auto = opts.autoIncludeClock ?? true;
      if (auto !== false) {
        const clockId = detectClockIdInline(
          signals, byFullPath, byLeaf,
          typeof auto === 'string' ? auto : undefined,
        );
        if (clockId) ids.add(clockId);
      }
      retainedIds = ids;
    } else {
      retainedIds = null;
    }
  }

  function isRetained(id: string): boolean {
    return retainedIds === null || retainedIds.has(id);
  }

  function recordChange(id: string, time: number, value: string): void {
    const sig = byId.get(id);
    if (!sig) return; // Unknown id (defensive — VCD shouldn't reference undeclared ids)
    if (sig.unsupported === 'real') {
      if (!warnedReal) {
        warnings.push('value type "real" not supported in v1; records dropped');
        warnedReal = true;
      }
      return;
    }
    if (sig.unsupported === 'string') {
      if (!warnedString) {
        warnings.push('value type "string" not supported in v1; records dropped');
        warnedString = true;
      }
      return;
    }
    let arr = changes.get(id);
    if (!arr) {
      arr = [];
      changes.set(id, arr);
    }
    arr.push({ time, value });
  }

  function processValueRecord(line: string): void {
    if (!line) return;
    const c = line[0];
    if (c === '0' || c === '1' || c === 'x' || c === 'X' || c === 'z' || c === 'Z') {
      // 1-bit scalar: <value><id>
      const id = line.slice(1);
      const retained = isRetained(id);
      opts.onBodyRecord?.(id, retained);
      if (retained) recordChange(id, currentTime, normalizeBits(c));
      return;
    }
    if (c === 'b' || c === 'B') {
      // Bus: b<bits> <id>
      const sp = line.indexOf(' ');
      if (sp < 0) return;
      const bits = line.slice(1, sp);
      const id = line.slice(sp + 1);
      const sig = byId.get(id);
      const retained = isRetained(id);
      opts.onBodyRecord?.(id, retained);
      if (retained && sig) {
        const padded = padBusValue(normalizeBits(bits), sig.width);
        recordChange(id, currentTime, padded);
      }
      return;
    }
    if (c === 'r' || c === 'R') {
      // Real: r<float> <id> — drop, but warn once if requested.
      const sp = line.indexOf(' ');
      if (sp < 0) return;
      const id = line.slice(sp + 1);
      const retained = isRetained(id);
      opts.onBodyRecord?.(id, retained);
      if (retained) recordChange(id, currentTime, '');
      return;
    }
    if (c === 's' || c === 'S') {
      // String: s<contents> <id> — last space separates contents from id.
      // VCD strings can contain spaces, so use lastIndexOf.
      const sp = line.lastIndexOf(' ');
      if (sp < 0) return;
      const id = line.slice(sp + 1);
      const retained = isRetained(id);
      opts.onBodyRecord?.(id, retained);
      if (retained) recordChange(id, currentTime, '');
      return;
    }
    // Unknown leading char — silently skip (defensive).
  }

  function handleDirective(name: string, body: string): void {
    if (name === 'timescale') {
      timescalePs = parseTimescale(body);
      return;
    }
    if (name === 'scope') {
      // $scope <type> <name>  — body has the args (type then name)
      const parts = body.trim().split(/\s+/);
      const scopeName = parts[1] ?? '';
      scopeStack.push(scopeName);
      return;
    }
    if (name === 'upscope') {
      scopeStack.pop();
      return;
    }
    if (name === 'var') {
      // $var <type> <width> <id> <name> [bitrange]
      // The body may legitimately contain a bitrange like "[31:0]" — we ignore
      // anything past name 4 elements in.
      const parts = body.trim().split(/\s+/);
      if (parts.length < 4) return;
      const [t, widthStr, id, name2] = parts;
      const width = parseInt(widthStr, 10);
      const fullPath = scopeStack.concat(name2).join('.');
      const type = classifyVarType(t);
      const sig: SignalInfo = {
        id,
        fullPath,
        leaf: name2,
        width: Number.isFinite(width) ? width : 0,
        type,
        ...(t === 'real' || t === 'realtime' ? { unsupported: 'real' as const } : {}),
        ...(t === 'string' ? { unsupported: 'string' as const } : {}),
      };
      // Multiple aliased $var entries can share an id (e.g. cross-scope wire).
      // First wins for byId so changes route consistently; lookup maps still
      // see all aliases.
      if (!byId.has(id)) byId.set(id, sig);
      signals.push(sig);
      pushMulti(byFullPath, fullPath, sig);
      pushMulti(byLeaf, name2, sig);
      return;
    }
    if (name === 'enddefinitions') {
      finishHeaderIfNeeded();
      return;
    }
    if (name === 'dumpvars' || name === 'dumpall' || name === 'dumpon') {
      // Body of the directive is value-change records (already processed line-by-line).
      // The wrapper itself is a no-op.
      return;
    }
    if (name === 'dumpoff') {
      // TODO: per VCD spec, $dumpoff drives all signals to 'x' at currentTime
      // until the matching $dumpon. None of the iverilog .vcd fixtures emit
      // it, so v1 no-ops. Implement when we encounter a VCD source that uses
      // it (likely an ILA capture from #46).
      return;
    }
    // $date, $version, $comment — ignore body.
  }

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    // Inside a $dumpvars/$dumpall/$dumpon block: lines are value-change records
    // until the matching $end. The block itself is just a delimiter.
    if (valueBlock !== null) {
      if (line === '$end') {
        valueBlock = null;
        continue;
      }
      if (line.startsWith('#')) {
        currentTime = parseInt(line.slice(1), 10);
        continue;
      }
      if (inHeader) finishHeaderIfNeeded();
      processValueRecord(line);
      continue;
    }

    // If we're collecting a multi-line directive, append until $end.
    if (directive !== null) {
      if (line === '$end') {
        handleDirective(directive, directiveBuf.join(' '));
        directive = null;
        directiveBuf = [];
      } else {
        directiveBuf.push(line);
      }
      continue;
    }

    if (line.startsWith('$')) {
      // Directive line. Could be single-line ($scope ... $end on one line) or open.
      const endIdx = line.indexOf('$end');
      const space = line.indexOf(' ');
      const name = line.slice(1, space < 0 ? line.length : space);
      if (VALUE_BLOCK.has(name)) {
        // Open a value-change block. Records on subsequent lines apply.
        if (inHeader) finishHeaderIfNeeded();
        valueBlock = name;
        // Single-line edge case: "$dumpvars 1! $end" — process inline.
        if (endIdx >= 0) {
          const inner = line.slice(space < 0 ? 1 + name.length : space + 1, endIdx).trim();
          if (inner) {
            for (const rec of inner.split(/\s+/)) processValueRecord(rec);
          }
          valueBlock = null;
        }
        continue;
      }
      if (endIdx >= 0) {
        // Single-line directive.
        const body = line.slice(space < 0 ? 1 + name.length : space + 1, endIdx).trim();
        handleDirective(name, body);
      } else {
        // Open multi-line directive.
        directive = name;
        if (space >= 0) directiveBuf.push(line.slice(space + 1));
      }
      continue;
    }

    if (line.startsWith('#')) {
      currentTime = parseInt(line.slice(1), 10);
      continue;
    }

    // Body-phase value-change record.
    if (inHeader) {
      // Defensive: VCDs sometimes have early value records before $enddefinitions
      // (e.g. tooling oddities). Treat as transition into body.
      finishHeaderIfNeeded();
    }
    processValueRecord(line);
  }

  return {
    timescalePs,
    signals,
    byFullPath,
    byLeaf,
    changes,
    resolved,
    resolutionErrors,
    warnings,
  };
}

/**
 * Tiny inline clock detector used at end-of-header to expand the retained-id
 * set. The full-fat `detectClock` lives in vcd-cycles.ts and operates on a
 * complete ParsedVcd; this duplicates the rules in ~10 lines to avoid a
 * circular import. If detection fails, returns undefined — the caller
 * (parser → handler) will surface a `no_clock` error downstream.
 */
function detectClockIdInline(
  signals: SignalInfo[],
  byFullPath: Map<string, SignalInfo[]>,
  byLeaf: Map<string, SignalInfo[]>,
  override: string | undefined,
): string | undefined {
  if (override) {
    const exact = byFullPath.get(override);
    if (exact && exact.length > 0) return exact[0].id;
    const leaf = byLeaf.get(override);
    if (leaf && leaf.length === 1) return leaf[0].id;
    return undefined;
  }
  const oneBit = signals.filter((s) => s.width === 1);
  const clockLike = oneBit.filter((s) => /^(clk|clock)$/i.test(s.leaf));
  if (clockLike.length === 0) return undefined;
  if (clockLike.length === 1) return clockLike[0].id;
  // Shallowest scope wins; tiebreak `tb.clk`.
  let best = clockLike[0];
  let bestDepth = best.fullPath.split('.').length;
  for (const s of clockLike) {
    const depth = s.fullPath.split('.').length;
    if (depth < bestDepth || (depth === bestDepth && s.fullPath === 'tb.clk')) {
      best = s;
      bestDepth = depth;
    }
  }
  return best.id;
}

function pushMulti<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(value);
}

// ── Signal lookup (folded into parser per plan) ──────────────────────────────

/**
 * Resolve a list of requested signals against the parsed header maps.
 *
 * Resolution rules (from plan):
 * - Input containing `.` → full-path-only (never fuzzy-matched).
 * - Otherwise: leaf exact match. Unique → use; multiple → ambiguous_signal;
 *   none → unknown_signal with Levenshtein suggestions over leaf names only.
 */
function resolveSignalsInternal(
  requested: string[],
  byFullPath: Map<string, SignalInfo[]>,
  byLeaf: Map<string, SignalInfo[]>,
  allSignals: SignalInfo[],
): { resolved: ResolvedSignal[]; errors: ResolutionError[] } {
  const resolved: ResolvedSignal[] = [];
  const errors: ResolutionError[] = [];

  for (const req of requested) {
    if (req.includes('.')) {
      const hits = byFullPath.get(req);
      if (!hits || hits.length === 0) {
        errors.push({
          type: 'unknown_signal',
          requested: req,
          // For full-path inputs we don't fuzzy-match leaves; suggest leaf
          // names as a hint anyway since that's what the plan specifies.
          suggestions: levenshteinTopK(req.split('.').pop() ?? req, [...byLeaf.keys()], 5),
        });
        continue;
      }
      resolved.push({ requested: req, resolved: hits[0] });
      continue;
    }
    const hits = byLeaf.get(req);
    if (!hits || hits.length === 0) {
      errors.push({
        type: 'unknown_signal',
        requested: req,
        suggestions: levenshteinTopK(req, [...byLeaf.keys()], 5),
      });
      continue;
    }
    if (hits.length > 1) {
      errors.push({
        type: 'ambiguous_signal',
        requested: req,
        candidates: hits.slice(0, 10).map((s) => s.fullPath),
      });
      continue;
    }
    resolved.push({ requested: req, resolved: hits[0] });
  }
  return { resolved, errors };
}

export function resolveSignals(
  parsed: Pick<ParsedVcd, 'byFullPath' | 'byLeaf' | 'signals'>,
  requested: string[],
): { resolved: ResolvedSignal[]; errors: ResolutionError[] } {
  return resolveSignalsInternal(requested, parsed.byFullPath, parsed.byLeaf, parsed.signals);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function levenshteinTopK(needle: string, candidates: string[], k: number): string[] {
  const scored = candidates.map((c) => ({ c, d: levenshtein(needle, c) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, k).map((s) => s.c);
}
