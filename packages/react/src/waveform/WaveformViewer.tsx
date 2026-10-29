/**
 * WaveformViewer: a simulation's inputs and outputs over time.
 *
 *   const sim = useSimulation(Counter);
 *   <WaveformViewer simulation={sim} />
 *
 * It records what the simulation reports while it's mounted: one column per
 * cycle, inputs (switches and number inputs) first, then outputs (lamps and
 * displays). Auto-run reports about 30 times a second, so a fast run skips
 * cycles and each value is held until the next report. Going back in history
 * moves the cursor without redrawing; a reset starts the trace again.
 */

import type { CircuitIR } from '@simten/core/internal';
import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { UseSimulationResult } from '../sandbox/useSimulation';

export interface WaveformViewerProps {
  /** What `useSimulation` returned. */
  simulation: UseSimulationResult;
  /** Shows a close button that calls this. */
  onClose?: () => void;
}

/** One row: a signal and its value at each cycle on screen. */
interface Signal {
  /** The `portValues` key it reads. */
  key: string;
  name: string;
  isInput: boolean;
  values: number[];
}

/** The most recent cycles kept on screen. */
const WINDOW = 256;
const CONTROLS = new Set(['Switch', 'Input']);
const INDICATORS = new Set(['Led', 'HexDisplay', 'Output']);

/** The circuit's inputs and outputs, as `portValues` keys: the session's top-level controls and indicators. */
function signalsOf(circuit: CircuitIR): { key: string; name: string; isInput: boolean }[] {
  const inputs = circuit.nodes
    .filter((n) => CONTROLS.has(n.componentRef))
    .map((n) => ({ key: `${n.id}.out`, name: n.label ?? n.id, isInput: true }));
  const outputs = circuit.nodes
    .filter((n) => INDICATORS.has(n.componentRef))
    .map((n) => ({ key: `${n.id}.in`, name: n.label ?? n.id, isInput: false }));
  const ports = [
    ...circuit.inputs.map((p) => ({ key: `__top__.${p.name}`, name: p.name, isInput: true })),
    ...circuit.outputs.map((p) => ({ key: `__top__.${p.name}`, name: p.name, isInput: false })),
  ];
  return [
    ...inputs,
    ...ports.filter((p) => p.isInput),
    ...outputs,
    ...ports.filter((p) => !p.isInput),
  ];
}

/** Values by cycle, recorded from the simulation's updates while mounted. */
function useTrace(simulation: UseSimulationResult): {
  trace: Map<number, ReadonlyMap<string, number>>;
  version: number;
} {
  const { circuit, portValues, cycle, history } = simulation.state;
  const viewingPast = history.isViewingPast;
  const trace = useRef(new Map<number, ReadonlyMap<string, number>>());
  const last = useRef<{ circuit: CircuitIR | null; cycle: number }>({ circuit: null, cycle: -1 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!circuit || !portValues) return;
    const before = last.current;
    // A new session, or a reset, starts the trace again. Going back through
    // history keeps it: the cursor moves instead.
    if (circuit !== before.circuit || (cycle < before.cycle && !viewingPast)) {
      trace.current = new Map();
    }
    last.current = { circuit, cycle };
    if (viewingPast) return;
    trace.current.set(cycle, portValues);
    for (const recorded of trace.current.keys()) {
      if (recorded <= cycle - WINDOW) trace.current.delete(recorded);
    }
    setVersion((v) => v + 1);
  }, [circuit, portValues, cycle, viewingPast]);

  return { trace: trace.current, version };
}

// ============================================================================
// Drawing
// ============================================================================

const CYCLE_WIDTH = 40;
const ROW_HEIGHT = 28;
const LABEL_WIDTH = 140;
const HEADER_HEIGHT = 24;
const INPUT_COLOR = '#60a5fa';
const OUTPUT_COLOR = '#34d399';

function isBitSignal(values: number[]): boolean {
  return values.every((v) => v === 0 || v === 1);
}

function BitWaveform({ values, color, width }: { values: number[]; color: string; width: number }) {
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

function BusWaveform({ values, color, width }: { values: number[]; color: string; width: number }) {
  const h = ROW_HEIGHT;
  const pad = 4;
  const top = pad;
  const bot = h - pad;
  const slant = 4;

  const rects: ReactNode[] = [];
  let runStart = 0;
  let runVal = values[0];

  function pushRun(start: number, end: number, val: number) {
    const x1 = start * CYCLE_WIDTH;
    const x2 = end * CYCLE_WIDTH;
    const hex = `0x${(val >>> 0).toString(16).toUpperCase()}`;
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

export function WaveformViewer({ simulation, onClose }: WaveformViewerProps): ReactElement {
  const { state } = simulation;
  const { trace, version } = useTrace(simulation);
  const scrollRef = useRef<HTMLDivElement>(null);

  const circuit = state.circuit;
  // `version` changes when the trace does; the Map itself is mutated in place.
  const { first, ticks, signals } = useMemo(() => {
    const cycles = [...trace.keys()];
    if (!circuit || cycles.length === 0) return { first: 0, ticks: 0, signals: [] as Signal[] };
    const firstCycle = Math.min(...cycles);
    const lastCycle = Math.max(...cycles);
    const count = lastCycle - firstCycle + 1;
    const rows: Signal[] = signalsOf(circuit).map((s) => ({ ...s, values: new Array(count) }));
    let held: ReadonlyMap<string, number> | undefined;
    for (let i = 0; i < count; i++) {
      held = trace.get(firstCycle + i) ?? held;
      for (const row of rows) row.values[i] = held?.get(row.key) ?? 0;
    }
    return { first: firstCycle, ticks: count, signals: rows };
  }, [trace, version, circuit]);

  // Keep the newest cycle in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !state.history.isViewingPast) el.scrollLeft = el.scrollWidth;
  }, [ticks, state.history.isViewingPast]);

  const waveWidth = Math.max(ticks * CYCLE_WIDTH, 100);
  const cursor = state.cycle - first;

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

  const gridLines = (height: number) => (
    <>
      {Array.from({ length: ticks }, (_, t) => (
        <line
          key={t}
          x1={t * CYCLE_WIDTH}
          y1={0}
          x2={t * CYCLE_WIDTH}
          y2={height}
          stroke="var(--border, #1e293b)"
          strokeWidth={1}
        />
      ))}
      {cursor >= 0 && cursor < ticks && (
        <rect
          x={cursor * CYCLE_WIDTH}
          y={0}
          width={CYCLE_WIDTH}
          height={height}
          fill="var(--foreground, #e5e5e5)"
          opacity={0.06}
        />
      )}
    </>
  );

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
      `}</style>

      <div style={headerStyle}>
        <span>Waveforms</span>
        <span style={{ fontWeight: 400, flex: 1 }}>
          {state.circuitName ?? ''}
          {ticks > 0 && ` — cycles ${first} to ${first + ticks - 1}`}
        </span>
        {onClose && (
          <button
            type="button"
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
          {signals.map((signal) => (
            <div
              key={signal.key}
              style={{
                width: LABEL_WIDTH,
                paddingRight: 8,
                paddingLeft: 8,
                textAlign: 'right',
                fontSize: 11,
                fontFamily: 'monospace',
                color: signal.isInput ? INPUT_COLOR : OUTPUT_COLOR,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                height: ROW_HEIGHT,
                lineHeight: `${ROW_HEIGHT}px`,
                borderBottom: '1px solid var(--border, #0d1929)',
              }}
              title={signal.key}
            >
              {signal.name}
            </div>
          ))}
        </div>

        {/* Scrollable waveform area */}
        <div
          ref={scrollRef}
          className="wf-scroll"
          style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1 }}
        >
          {/* Cycle header */}
          <svg width={waveWidth} height={HEADER_HEIGHT} style={{ display: 'block' }}>
            {gridLines(HEADER_HEIGHT)}
            {Array.from({ length: ticks }, (_, i) =>
              (first + i) % 2 === 0 ? (
                <text
                  key={i}
                  x={i * CYCLE_WIDTH + CYCLE_WIDTH / 2}
                  y={14}
                  textAnchor="middle"
                  fill="var(--muted-foreground, #475569)"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {first + i}
                </text>
              ) : null,
            )}
          </svg>

          {signals.map((signal) => {
            const color = signal.isInput ? INPUT_COLOR : OUTPUT_COLOR;
            return (
              <div
                key={signal.key}
                style={{
                  position: 'relative',
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid var(--border, #0d1929)',
                }}
              >
                {isBitSignal(signal.values) ? (
                  <BitWaveform values={signal.values} color={color} width={waveWidth} />
                ) : (
                  <BusWaveform values={signal.values} color={color} width={waveWidth} />
                )}
                <svg
                  width={waveWidth}
                  height={ROW_HEIGHT}
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                >
                  {gridLines(ROW_HEIGHT)}
                </svg>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
