import { useMemo, useRef, useEffect, type CSSProperties } from "react";

export interface TracesPayload {
  circuit: string;
  ticks: number;
  inputs: string[];
  outputs: string[];
  signals: Record<string, Array<{ value: boolean | number; count: number }>>;
  steadyStateAt?: number;
}

export interface WaveformViewerProps {
  signals: TracesPayload["signals"];
  inputs: string[];
  outputs: string[];
  ticks: number;
  circuit: string;
  steadyStateAt?: number;
}

// Decode RLE into per-cycle flat array
function decodeRLE(
  rle: Array<{ value: boolean | number; count: number }>,
  ticks: number
): Array<boolean | number> {
  const out: Array<boolean | number> = [];
  for (const { value, count } of rle) {
    for (let i = 0; i < count && out.length < ticks; i++) {
      out.push(value);
    }
  }
  // Pad if needed
  while (out.length < ticks) {
    out.push(out.length > 0 ? out[out.length - 1] : 0);
  }
  return out;
}

function isBitSignal(values: Array<boolean | number>): boolean {
  return values.every((v) => v === true || v === false || v === 0 || v === 1);
}

const CYCLE_WIDTH = 40;
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 100;
const HEADER_HEIGHT = 24;

const INPUT_COLOR = "#60a5fa"; // blue-400
const OUTPUT_COLOR = "#34d399"; // emerald-400

function BitWaveform({
  values,
  color,
  width,
}: {
  values: Array<boolean | number>;
  color: string;
  width: number;
}) {
  const h = ROW_HEIGHT;
  const high = 6;
  const low = h - 6;

  let d = "";
  for (let i = 0; i < values.length; i++) {
    const x = i * CYCLE_WIDTH;
    const y = values[i] ? high : low;
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      const prevY = values[i - 1] ? high : low;
      if (y !== prevY) {
        d += ` L ${x} ${prevY} L ${x} ${y}`;
      }
    }
    d += ` L ${x + CYCLE_WIDTH} ${y}`;
  }

  // Build fill path: trace waveform then close along the low baseline
  const fillD = d + ` L ${values.length * CYCLE_WIDTH} ${low} L 0 ${low} Z`;

  return (
    <svg width={width} height={h} style={{ display: "block" }}>
      {/* Low baseline */}
      <line x1={0} y1={low} x2={width} y2={low} stroke="#334155" strokeWidth={1} />
      {/* Filled area under waveform — makes high/low instantly visible */}
      <path d={fillD} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

function BusWaveform({
  values,
  color,
  width,
}: {
  values: Array<boolean | number>;
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

  function pushRun(start: number, end: number, val: boolean | number) {
    const x1 = start * CYCLE_WIDTH;
    const x2 = end * CYCLE_WIDTH;
    const hex = typeof val === "number" ? `0x${(val >>> 0).toString(16).toUpperCase()}` : String(val);

    // Diamond / parallelogram shape
    const points = [
      `${x1 + slant},${top}`,
      `${x2 - slant},${top}`,
      `${x2},${(top + bot) / 2}`,
      `${x2 - slant},${bot}`,
      `${x1 + slant},${bot}`,
      `${x1},${(top + bot) / 2}`,
    ].join(" ");

    rects.push(
      <g key={start}>
        <polygon
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.6}
        />
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
      </g>
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
    <svg width={width} height={h} style={{ display: "block" }}>
      {rects}
    </svg>
  );
}

function SignalWaveform({
  values,
  color,
  width,
}: {
  values: Array<boolean | number>;
  color: string;
  width: number;
}) {
  const isBit = isBitSignal(values);
  return isBit ? (
    <BitWaveform values={values} color={color} width={width} />
  ) : (
    <BusWaveform values={values} color={color} width={width} />
  );
}

function SignalLabel({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        width: LABEL_WIDTH,
        flexShrink: 0,
        paddingRight: 8,
        textAlign: "right",
        fontSize: 11,
        fontFamily: "monospace",
        color,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
      }}
      title={name}
    >
      {name}
    </div>
  );
}

export function WaveformViewer({
  signals,
  inputs,
  outputs,
  ticks,
  circuit,
  steadyStateAt,
}: WaveformViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const decoded = useMemo(() => {
    const result: Record<string, Array<boolean | number>> = {};
    for (const [name, rle] of Object.entries(signals)) {
      result[name] = decodeRLE(rle, ticks);
    }
    return result;
  }, [signals, ticks]);

  const waveWidth = ticks * CYCLE_WIDTH;
  const allSignals = [...inputs, ...outputs.filter((o) => !inputs.includes(o))];

  // Scroll to end on new data
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [signals]);

  const containerStyle: CSSProperties = {
    background: "#0f172a",
    borderTop: "1px solid #334155",
    fontSize: 12,
    color: "#94a3b8",
  };

  const headerStyle: CSSProperties = {
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #1e293b",
    fontSize: 11,
    fontWeight: 600,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        .waveform-scroll {
          scrollbar-width: thin;
          scrollbar-color: #334155 transparent;
        }
        .waveform-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .waveform-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .waveform-scroll::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }
        .waveform-scroll::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
      <div style={headerStyle}>
        <span>Waveforms</span>
        <span style={{ fontWeight: 400 }}>
          {circuit} — {ticks} ticks
          {steadyStateAt != null && (
            <span style={{ color: "#34d399", marginLeft: 6 }}>
              steady @ tick {steadyStateAt}
            </span>
          )}
        </span>
      </div>

      {/* Two-column layout: fixed labels | scrollable waveforms */}
      <div style={{ display: "flex" }}>
        {/* Fixed label column */}
        <div style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
          <div style={{ height: HEADER_HEIGHT }} />
          {allSignals.map((name) => {
            if (!decoded[name]) return null;
            const color = inputs.includes(name) ? INPUT_COLOR : OUTPUT_COLOR;
            return <SignalLabel key={name} name={name} color={color} />;
          })}
        </div>

        {/* Scrollable waveform area */}
        <div ref={scrollRef} className="waveform-scroll" style={{ overflowX: "auto", overflowY: "hidden", flex: 1 }}>
          {/* Cycle numbers header */}
          <svg width={waveWidth} height={HEADER_HEIGHT} style={{ display: "block" }}>
            {Array.from({ length: ticks }, (_, i) => (
              <g key={i}>
                <line
                  x1={i * CYCLE_WIDTH}
                  y1={0}
                  x2={i * CYCLE_WIDTH}
                  y2={HEADER_HEIGHT}
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                {i % 5 === 0 && (
                  <text
                    x={i * CYCLE_WIDTH + CYCLE_WIDTH / 2}
                    y={14}
                    textAnchor="middle"
                    fill="#475569"
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

          {/* Signal waveforms */}
          {allSignals.map((name) => {
            const values = decoded[name];
            if (!values) return null;
            const color = inputs.includes(name) ? INPUT_COLOR : OUTPUT_COLOR;
            return (
              <div key={name} style={{ position: "relative", height: ROW_HEIGHT }}>
                <SignalWaveform values={values} color={color} width={waveWidth} />
                {/* Grid lines */}
                <svg
                  width={waveWidth}
                  height={ROW_HEIGHT}
                  style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                >
                  {Array.from({ length: ticks }, (_, i) => (
                    <line
                      key={i}
                      x1={i * CYCLE_WIDTH}
                      y1={0}
                      x2={i * CYCLE_WIDTH}
                      y2={ROW_HEIGHT}
                      stroke="#1e293b"
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
