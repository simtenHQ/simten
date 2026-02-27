import { useState, useEffect, useRef, useCallback } from "react";
import { useCircuitSimulator, CircuitCanvas } from "@turing-incomplete/ui/embed";
import { Tooltip } from "radix-ui";
const TooltipProvider = Tooltip.Provider;

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export function App() {
  const [dsl, setDsl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const retryDelay = useRef(1000);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      setError(null);
      retryDelay.current = 1000;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "dsl") {
          setDsl(data.source);
          setError(null);
        } else if (data.type === "error") {
          setError(data.message);
        } else if (data.type === "file-deleted") {
          setError("Watched file was deleted");
          setDsl(null);
        }
      } catch {
        // non-JSON message, ignore
      }
    };

    es.onerror = () => {
      es.close();
      setStatus("reconnecting");
      const delay = retryDelay.current;
      retryDelay.current = Math.min(delay * 2, 30000);
      setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const statusColor: Record<ConnectionStatus, string> = {
    connecting: "#fbbf24",
    connected: "#34d399",
    reconnecting: "#fbbf24",
    disconnected: "#f87171",
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Status bar */}
      <div
        style={{
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusColor[status],
          }}
        />
        <span style={{ color: "#94a3b8" }}>
          {status === "connecting" && "Connecting..."}
          {status === "connected" && "Live"}
          {status === "reconnecting" && "Reconnecting..."}
          {status === "disconnected" && "Disconnected"}
        </span>
        {error && (
          <span style={{ color: "#f87171", marginLeft: "auto" }}>{error}</span>
        )}
      </div>

      {/* Circuit area */}
      {dsl ? (
        <CircuitArea dsl={dsl} isAutoRunning={isAutoRunning} setIsAutoRunning={setIsAutoRunning} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {error || "Waiting for circuit..."}
        </div>
      )}
    </div>
  );
}

function CircuitArea({
  dsl,
  isAutoRunning,
  setIsAutoRunning,
}: {
  dsl: string;
  isAutoRunning: boolean;
  setIsAutoRunning: (v: boolean) => void;
}) {
  const sim = useCircuitSimulator(dsl);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAutoRunning && sim.ready && sim.isSequential) {
      intervalRef.current = setInterval(() => sim.tick(), 500);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoRunning, sim.ready, sim.isSequential, sim.tick]);

  const handleReset = useCallback(() => {
    setIsAutoRunning(false);
    sim.reset();
  }, [sim.reset, setIsAutoRunning]);

  if (sim.error) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ color: "#f87171", fontFamily: "monospace", fontSize: 13, maxWidth: 600 }}>
          {sim.error}
        </div>
      </div>
    );
  }

  if (!sim.ready) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>Compiling circuit...</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Canvas — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CircuitCanvas
          circuit={sim.circuit}
          portValues={sim.portValues}
          sequentialState={sim.sequentialState}
          onToggleNode={sim.toggleNode}
          onSetNodeValue={sim.setNodeValue}
          height="100%"
        />
      </div>

      {/* Controls bar — fixed at bottom */}
      {sim.isSequential && (
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0f172a",
            borderTop: "1px solid #334155",
            flexShrink: 0,
          }}
        >
          <button
            onClick={sim.tick}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
            }}
          >
            Tick
          </button>
          <button
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              background: isAutoRunning ? "#d97706" : "#374151",
              color: "white",
              cursor: "pointer",
            }}
          >
            {isAutoRunning ? "Pause" : "Auto"}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              background: "#374151",
              color: "white",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "#64748b",
              fontFamily: "monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Cycle {sim.cycleCount}
          </span>
        </div>
      )}
    </TooltipProvider>
  );
}
