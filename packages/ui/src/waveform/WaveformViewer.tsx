import {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';

// ============================================================================
// VCD Parser — scope-aware
// ============================================================================

export interface VCDSignal {
  /** Fully-qualified key: "scope.name" or just "name" at root */
  key: string;
  /** Display name (last path segment) */
  name: string;
  /** Scope path, e.g. ["Counter", "reg"] */
  scope: string[];
  width: number;
  values: (number | boolean)[];
}

export interface ParsedVCD {
  /** Top-level circuit/module name */
  circuit: string;
  ticks: number;
  /** All signals, ordered by declaration */
  signals: VCDSignal[];
  /** Unique scope paths present (excluding root), ordered */
  scopes: string[][];
}

export function parseVCD(vcd: string): ParsedVCD {
  const lines = vcd.split('\n');

  // Pass 1: build id → {name, scope[], width} map
  type VarMeta = { name: string; scope: string[]; width: number };
  const idMeta: Record<string, VarMeta> = {};
  const scopeStack: string[] = [];
  let circuit = 'circuit';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('$scope module ')) {
      const scopeName = line.replace('$scope module ', '').replace(' $end', '').trim();
      if (scopeStack.length === 0) circuit = scopeName;
      scopeStack.push(scopeName);
    } else if (line.startsWith('$upscope')) {
      scopeStack.pop();
    } else if (line.startsWith('$var wire ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const width = parseInt(parts[2], 10);
        const id = parts[3];
        const name = parts[4];
        idMeta[id] = { name, scope: [...scopeStack], width };
      }
    }
  }

  // Collect ordered ids
  const orderedIds: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('$var wire ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) orderedIds.push(parts[3]);
    }
  }

  // Pass 2: replay value changes
  let maxTick = 0;
  let currentTick = 0;
  const rawChanges: Array<{ tick: number; id: string; value: number | boolean }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('#')) {
      currentTick = parseInt(line.slice(1), 10);
      if (currentTick > maxTick) maxTick = currentTick;
      continue;
    }

    if (
      (line.startsWith('0') || line.startsWith('1')) &&
      line.length >= 2 &&
      !line.startsWith('$')
    ) {
      const val = line[0] === '1';
      const id = line.slice(1);
      if (idMeta[id]) rawChanges.push({ tick: currentTick, id, value: val });
      continue;
    }

    if (line.startsWith('b')) {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        const binStr = line.slice(1, spaceIdx);
        const id = line.slice(spaceIdx + 1).trim();
        if (idMeta[id]) rawChanges.push({ tick: currentTick, id, value: parseInt(binStr, 2) });
      }
    }
  }

  const ticks = maxTick;

  // Build per-signal value arrays
  const valueArrays: Record<string, (number | boolean)[]> = {};
  const lastValue: Record<string, number | boolean> = {};

  for (const id of orderedIds) {
    const meta = idMeta[id];
    if (!meta) continue;
    const init: number | boolean = meta.width === 1 ? false : 0;
    valueArrays[id] = new Array(ticks).fill(init);
    lastValue[id] = init;
  }

  rawChanges.sort((a, b) => a.tick - b.tick);

  for (const { tick, id, value } of rawChanges) {
    if (!valueArrays[id]) continue;
    lastValue[id] = value;
    for (let t = tick; t < ticks; t++) {
      valueArrays[id][t] = value;
    }
  }

  // Build signal list (deduplicate by key = scope path + name)
  const seenKeys = new Set<string>();
  const signals: VCDSignal[] = [];

  for (const id of orderedIds) {
    const meta = idMeta[id];
    if (!meta) continue;
    // Key: "Counter/reg/data" style — use "/" separator for display
    const scopePath = meta.scope.slice(1); // drop root circuit name
    const key = [...scopePath, meta.name].join('/');

    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    signals.push({
      key,
      name: meta.name,
      scope: meta.scope,
      width: meta.width,
      values: valueArrays[id] ?? [],
    });
  }

  // Collect unique non-root scopes
  const scopeKeySet = new Set<string>();
  const scopes: string[][] = [];
  for (const sig of signals) {
    if (sig.scope.length <= 1) continue; // root-level, no sub-scope
    const sub = sig.scope.slice(1);
    const k = sub.join('/');
    if (!scopeKeySet.has(k)) {
      scopeKeySet.add(k);
      scopes.push(sub);
    }
  }

  return { circuit, ticks, signals, scopes };
}

// ============================================================================
// Rendering
// ============================================================================

const CYCLE_WIDTH = 40;
const ROW_HEIGHT = 28;
const LABEL_WIDTH = 140;
const HEADER_HEIGHT = 24;
const SCOPE_ROW_HEIGHT = 20;
const INPUT_COLOR = '#60a5fa';
const OUTPUT_COLOR = '#34d399';
const INTERNAL_COLOR = '#a78bfa';

function isBitSignal(values: (number | boolean)[]): boolean {
  return values.every((v) => v === 0 || v === 1 || v === true || v === false);
}

function BitWaveform({
  values,
  color,
  width,
}: {
  values: (number | boolean)[];
  color: string;
  width: number;
}) {
  const h = ROW_HEIGHT;
  const high = 5;
  const low = h - 5;

  let d = '';
  for (let i = 0; i < values.length; i++) {
    const x = i * CYCLE_WIDTH;
    const y = values[i] ? high : low;
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      const prevY = values[i - 1] ? high : low;
      if (y !== prevY) d += ` L ${x} ${prevY} L ${x} ${y}`;
    }
    d += ` L ${x + CYCLE_WIDTH} ${y}`;
  }

  const fillD = d + ` L ${values.length * CYCLE_WIDTH} ${low} L 0 ${low} Z`;

  return (
    <svg width={width} height={h} style={{ display: 'block' }}>
      <path d={fillD} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function BusWaveform({
  values,
  color,
  width,
}: {
  values: (number | boolean)[];
  color: string;
  width: number;
}) {
  const h = ROW_HEIGHT;
  const pad = 4;
  const top = pad;
  const bot = h - pad;
  const slant = 4;

  const rects: React.ReactNode[] = [];
  let runStart = 0;
  let runVal = values[0];

  function pushRun(start: number, end: number, val: number | boolean) {
    const x1 = start * CYCLE_WIDTH;
    const x2 = end * CYCLE_WIDTH;
    const hex =
      typeof val === 'number' ? `0x${(val >>> 0).toString(16).toUpperCase()}` : String(val);
    const runWidth = x2 - x1;
    const points = [
      `${x1 + Math.min(slant, runWidth / 2)},${top}`,
      `${x2 - Math.min(slant, runWidth / 2)},${top}`,
      `${x2},${(top + bot) / 2}`,
      `${x2 - Math.min(slant, runWidth / 2)},${bot}`,
      `${x1 + Math.min(slant, runWidth / 2)},${bot}`,
      `${x1},${(top + bot) / 2}`,
    ].join(' ');
    rects.push(
      <g key={start}>
        <polygon
          points={points}
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.6}
        />
        {runWidth >= 24 && (
          <text
            x={(x1 + x2) / 2}
            y={h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize={10}
            fontFamily="monospace"
          >
            {hex}
          </text>
        )}
      </g>,
    );
  }

  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== runVal) {
      pushRun(runStart, i, runVal);
      if (i < values.length) {
        runStart = i;
        runVal = values[i];
      }
    }
  }

  return (
    <svg width={width} height={h} style={{ display: 'block' }}>
      {rects}
    </svg>
  );
}

// ============================================================================
// Scope grouping
// ============================================================================

/**
 * Group signals into scope sections.
 * Root-level signals come first (no heading), then each sub-scope gets a header.
 */
function groupByScope(
  signals: VCDSignal[],
  _circuit: string,
): Array<
  | { type: 'root'; signals: VCDSignal[] }
  | { type: 'scope'; label: string; depth: number; signals: VCDSignal[] }
> {
  const rootSignals = signals.filter((s) => s.scope.length <= 1);

  // Group by immediate child scope under root
  const scopeMap = new Map<string, VCDSignal[]>();
  for (const sig of signals) {
    if (sig.scope.length <= 1) continue;
    const immediateScope = sig.scope.slice(1).join('/');
    if (!scopeMap.has(immediateScope)) scopeMap.set(immediateScope, []);
    scopeMap.get(immediateScope)!.push(sig);
  }

  const result: ReturnType<typeof groupByScope> = [];
  if (rootSignals.length > 0) result.push({ type: 'root', signals: rootSignals });

  for (const [scopePath, sigs] of scopeMap) {
    const parts = scopePath.split('/');
    result.push({
      type: 'scope',
      label: parts.join(' › '),
      depth: parts.length - 1,
      signals: sigs,
    });
  }

  return result;
}

// ============================================================================
// Public component
// ============================================================================

export interface WaveformViewerProps {
  vcd: string;
  inputs?: string[];
  circuit?: string;
  steadyStateAt?: number;
  onLoadVCD?: (vcd: string) => void;
  onClose?: () => void;
}

export function WaveformViewer({
  vcd,
  inputs: inputOverride,
  circuit: circuitOverride,
  steadyStateAt,
  onLoadVCD,
  onClose,
}: WaveformViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => parseVCD(vcd), [vcd]);
  const circuit = circuitOverride ?? parsed.circuit;
  const inputSet = new Set(inputOverride ?? []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setCollapsedScopes(new Set());
  }, [vcd]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text) onLoadVCD?.(text);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onLoadVCD],
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([vcd], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${circuit}.vcd`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vcd, circuit]);

  const toggleScope = useCallback((label: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const groups = useMemo(() => groupByScope(parsed.signals, circuit), [parsed.signals, circuit]);

  const waveWidth = Math.max(parsed.ticks * CYCLE_WIDTH, 100);

  // Collect ordered rows for the scrollable waveform column
  type Row =
    | { type: 'signal'; signal: VCDSignal; color: string }
    | { type: 'scope-header'; label: string; height: number };
  const rows: Row[] = [];
  const labelRows: Row[] = [];

  for (const group of groups) {
    if (group.type === 'scope') {
      const collapsed = collapsedScopes.has(group.label);
      labelRows.push({ type: 'scope-header', label: group.label, height: SCOPE_ROW_HEIGHT });
      rows.push({ type: 'scope-header', label: group.label, height: SCOPE_ROW_HEIGHT });
      if (!collapsed) {
        for (const sig of group.signals) {
          const isInput = inputSet.has(sig.name);
          const color = isInput ? INPUT_COLOR : INTERNAL_COLOR;
          labelRows.push({ type: 'signal', signal: sig, color });
          rows.push({ type: 'signal', signal: sig, color });
        }
      }
    } else {
      for (const sig of group.signals) {
        const isInput = inputSet.has(sig.name);
        const color = isInput ? INPUT_COLOR : OUTPUT_COLOR;
        labelRows.push({ type: 'signal', signal: sig, color });
        rows.push({ type: 'signal', signal: sig, color });
      }
    }
  }

  const containerStyle: CSSProperties = {
    background: 'var(--card, #0f172a)',
    borderTop: '1px solid var(--border, #334155)',
    fontSize: 12,
    color: 'var(--muted-foreground, #94a3b8)',
    userSelect: 'none',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  };

  const headerStyle: CSSProperties = {
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid var(--border, #1e293b)',
    fontSize: 11,
    fontWeight: 600,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        .wf-scroll { scrollbar-width: thin; scrollbar-color: var(--border, #334155) transparent; }
        .wf-scroll::-webkit-scrollbar { height: 6px; }
        .wf-scroll::-webkit-scrollbar-track { background: transparent; }
        .wf-scroll::-webkit-scrollbar-thumb { background: var(--border, #334155); border-radius: 3px; }
        .wf-scroll::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground, #475569); }
        .wf-btn { background: var(--muted, #1e293b); border: 1px solid var(--border, #334155); color: var(--muted-foreground, #94a3b8); padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }
        .wf-btn:hover { background: var(--accent, #334155); color: var(--accent-foreground, inherit); }
        .wf-scope-hdr { display: flex; align-items: center; gap: 4px; padding: 0 8px; background: var(--muted, #0d1929); border-bottom: 1px solid var(--border, #1e293b); border-top: 1px solid var(--border, #1e293b); cursor: pointer; font-family: monospace; font-size: 10px; color: var(--muted-foreground, #64748b); opacity: 0.85; }
        .wf-scope-hdr:hover { color: var(--foreground, #94a3b8); opacity: 1; }
      `}</style>

      <div style={headerStyle}>
        <span>Waveforms</span>
        <span style={{ fontWeight: 400, flex: 1 }}>
          {circuit} — {parsed.ticks} ticks
          {steadyStateAt != null && (
            <span style={{ color: '#34d399', marginLeft: 6 }}>steady @ tick {steadyStateAt}</span>
          )}
        </span>
        <button className="wf-btn" onClick={handleDownload} title={`Save ${circuit}.vcd`}>
          Save VCD
        </button>
        <button className="wf-btn" onClick={() => fileInputRef.current?.click()}>
          Load VCD
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcd"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {onClose && (
          <button
            className="wf-btn"
            onClick={onClose}
            title="Close waveform panel"
            aria-label="Close waveform panel"
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* Fixed label column */}
        <div
          style={{
            width: LABEL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid var(--border, #1e293b)',
          }}
        >
          <div style={{ height: HEADER_HEIGHT }} />
          {labelRows.map((row, i) => {
            if (row.type === 'scope-header') {
              const collapsed = collapsedScopes.has(row.label);
              return (
                <div
                  key={`sh-${i}`}
                  className="wf-scope-hdr"
                  style={{ height: SCOPE_ROW_HEIGHT }}
                  onClick={() => toggleScope(row.label)}
                >
                  <span style={{ fontSize: 9 }}>{collapsed ? '▶' : '▼'}</span>
                  <span>{row.label}</span>
                </div>
              );
            }
            const isScope = row.signal.scope.length > 1;
            return (
              <div
                key={`lbl-${i}`}
                style={{
                  width: LABEL_WIDTH,
                  paddingRight: 8,
                  paddingLeft: isScope ? 16 : 8,
                  textAlign: 'right',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: row.color,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  height: ROW_HEIGHT,
                  lineHeight: `${ROW_HEIGHT}px`,
                  borderBottom: '1px solid var(--border, #0d1929)',
                }}
                title={row.signal.key}
              >
                {row.signal.name}
              </div>
            );
          })}
        </div>

        {/* Scrollable waveform area */}
        <div
          ref={scrollRef}
          className="wf-scroll"
          style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1 }}
        >
          {/* Tick header */}
          <svg width={waveWidth} height={HEADER_HEIGHT} style={{ display: 'block' }}>
            {Array.from({ length: parsed.ticks }, (_, i) => (
              <g key={i}>
                <line
                  x1={i * CYCLE_WIDTH}
                  y1={0}
                  x2={i * CYCLE_WIDTH}
                  y2={HEADER_HEIGHT}
                  stroke="var(--border, #1e293b)"
                  strokeWidth={1}
                />
                {i % 2 === 0 && (
                  <text
                    x={i * CYCLE_WIDTH + CYCLE_WIDTH / 2}
                    y={14}
                    textAnchor="middle"
                    fill="var(--muted-foreground, #475569)"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {i}
                  </text>
                )}
              </g>
            ))}
            {steadyStateAt != null && (
              <line
                x1={steadyStateAt * CYCLE_WIDTH}
                y1={0}
                x2={steadyStateAt * CYCLE_WIDTH}
                y2={HEADER_HEIGHT}
                stroke="#34d399"
                strokeWidth={2}
                strokeDasharray="3,3"
              />
            )}
          </svg>

          {/* Rows */}
          {rows.map((row, i) => {
            if (row.type === 'scope-header') {
              return (
                <div
                  key={`wsh-${i}`}
                  style={{
                    height: SCOPE_ROW_HEIGHT,
                    background: 'var(--muted, #0d1929)',
                    borderBottom: '1px solid var(--border, #1e293b)',
                    borderTop: '1px solid var(--border, #1e293b)',
                  }}
                />
              );
            }

            const { signal, color } = row;
            const isBit = isBitSignal(signal.values);
            return (
              <div
                key={`wav-${i}`}
                style={{
                  position: 'relative',
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid var(--border, #0d1929)',
                }}
              >
                {isBit ? (
                  <BitWaveform values={signal.values} color={color} width={waveWidth} />
                ) : (
                  <BusWaveform values={signal.values} color={color} width={waveWidth} />
                )}
                {/* Grid lines */}
                <svg
                  width={waveWidth}
                  height={ROW_HEIGHT}
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                >
                  {Array.from({ length: parsed.ticks }, (_, t) => (
                    <line
                      key={t}
                      x1={t * CYCLE_WIDTH}
                      y1={0}
                      x2={t * CYCLE_WIDTH}
                      y2={ROW_HEIGHT}
                      stroke="var(--border, #1e293b)"
                      strokeWidth={1}
                    />
                  ))}
                  {steadyStateAt != null && (
                    <line
                      x1={steadyStateAt * CYCLE_WIDTH}
                      y1={0}
                      x2={steadyStateAt * CYCLE_WIDTH}
                      y2={ROW_HEIGHT}
                      stroke="#34d399"
                      strokeWidth={2}
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
