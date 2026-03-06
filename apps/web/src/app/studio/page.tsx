"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCircuitSimulator, CircuitCanvas } from "@turing-incomplete/ui/embed";
import { WaveformViewer, TestResultsPanel } from "@turing-incomplete/ui/shared";
import type { TracesPayload, TestResult } from "@turing-incomplete/ui/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

const STATUS_DOT_COLOR: Record<ConnectionStatus, string> = {
  idle: "bg-slate-500",
  connecting: "bg-amber-400",
  connected: "bg-emerald-400",
  reconnecting: "bg-amber-400",
  disconnected: "bg-red-400",
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting to Claude Code...",
  connected: "Connected to Claude Code",
  reconnecting: "Reconnecting to Claude Code...",
  disconnected: "Disconnected from Claude Code",
};

function StudioContent() {
  const searchParams = useSearchParams();
  const portParam = searchParams.get("port");

  const [dsl, setDsl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(portParam ? "connecting" : "idle");
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [traces, setTraces] = useState<TracesPayload | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const retryDelay = useRef(1000);
  const eventSourceRef = useRef<EventSource | null>(null);

  const baseUrl = portParam ? `http://localhost:${portParam}` : null;

  const connect = useCallback(() => {
    if (!baseUrl) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${baseUrl}/api/events`);
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
        } else if (data.type === "traces") {
          setTraces(data.data);
        } else if (data.type === "test-results") {
          setTestResults(data.data.results);
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
  }, [baseUrl]);

  useEffect(() => {
    if (!baseUrl) return;
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [baseUrl, connect]);

  // Standalone mode — no port param
  if (!baseUrl) {
    return (
      <div className="flex h-screen flex-col bg-slate-900">
        <StatusBar status="idle" error={null} port={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <h1 className="text-2xl font-semibold text-slate-200">
            Turing Incomplete Studio
          </h1>
          <p className="max-w-sm text-center text-sm text-slate-500">
            This page displays live circuit previews from Claude Code.
            Use the{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
              show_circuit
            </code>{" "}
            MCP tool to connect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900">
      <StatusBar status={status} error={error} port={portParam} />

      {dsl ? (
        <CircuitArea
          dsl={dsl}
          baseUrl={baseUrl}
          isAutoRunning={isAutoRunning}
          setIsAutoRunning={setIsAutoRunning}
          traces={traces}
          testResults={testResults}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          {error || "Waiting for circuit..."}
        </div>
      )}
    </div>
  );
}

function StatusBar({
  status,
  error,
  port,
}: {
  status: ConnectionStatus;
  error: string | null;
  port: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2 text-[13px]">
      <div className={`h-2 w-2 rounded-full ${STATUS_DOT_COLOR[status]}`} />
      <span className="text-slate-400">{STATUS_TEXT[status]}</span>
      {status === "connected" && port && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default font-mono text-[11px] text-slate-600">
                :{port}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Receiving live updates from Claude Code via localhost:{port}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {error && (
        <span className="ml-auto text-red-400">{error}</span>
      )}
    </div>
  );
}

function CircuitArea({
  dsl,
  baseUrl,
  isAutoRunning,
  setIsAutoRunning,
  traces,
  testResults,
}: {
  dsl: string;
  baseUrl: string;
  isAutoRunning: boolean;
  setIsAutoRunning: (v: boolean) => void;
  traces: TracesPayload | null;
  testResults: TestResult[] | null;
}) {
  const sim = useCircuitSimulator(dsl);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report state to the local MCP server for get_circuit_state readback
  useEffect(() => {
    if (!sim.ready) return;
    const body = JSON.stringify({
      cycleCount: sim.cycleCount,
      inputs: sim.inputs,
      outputs: sim.outputs,
      isSequential: sim.isSequential,
      circuitName: sim.circuit?.name ?? null,
      timestamp: Date.now(),
    });
    fetch(`${baseUrl}/api/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {/* fire-and-forget */});
  }, [baseUrl, sim.ready, sim.cycleCount, sim.inputs, sim.outputs, sim.isSequential, sim.circuit]);

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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-xl font-mono text-[13px] text-red-400">
          {sim.error}
        </div>
      </div>
    );
  }

  if (!sim.ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-slate-400">Compiling circuit...</span>
      </div>
    );
  }

  return (
    <>
      {/* Canvas */}
      <div className="min-h-0 flex-1">
        <CircuitCanvas
          circuit={sim.circuit}
          portValues={sim.portValues}
          sequentialState={sim.sequentialState}
          onToggleNode={sim.toggleNode}
          onSetNodeValue={sim.setNodeValue}
          height="100%"
        />
      </div>

      {/* Waveform panel */}
      {traces && (
        <div className="max-h-[35vh] shrink-0 overflow-auto">
          <WaveformViewer
            signals={traces.signals}
            inputs={traces.inputs}
            outputs={traces.outputs}
            ticks={traces.ticks}
            circuit={traces.circuit}
            steadyStateAt={traces.steadyStateAt}
          />
        </div>
      )}

      {/* Test results panel */}
      {testResults && (
        <div className="max-h-[30vh] shrink-0 overflow-auto">
          <TestResultsPanel results={testResults} />
        </div>
      )}

      {/* Controls bar */}
      {sim.isSequential && (
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-700 bg-slate-950 px-3 py-2">
          <button
            onClick={sim.tick}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            Tick
          </button>
          <button
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
              isAutoRunning
                ? "bg-amber-600 hover:bg-amber-500"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {isAutoRunning ? "Pause" : "Auto"}
          </button>
          <button
            onClick={handleReset}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
          >
            Reset
          </button>
          <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">
            Cycle {sim.cycleCount}
          </span>
        </div>
      )}
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-900">
          <span className="text-slate-500">Loading...</span>
        </div>
      }
    >
      <StudioContent />
    </Suspense>
  );
}
