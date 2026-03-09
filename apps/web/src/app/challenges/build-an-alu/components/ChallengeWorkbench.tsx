"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import type { ChallengeStage } from "../steps";
import { useChallengeSync } from "../../useChallengeSync";

export function ChallengeWorkbench({ stage, challengeId, onNavigate }: { stage: ChallengeStage; challengeId: string; onNavigate: (stageId: string) => void }) {
  const [connections, setConnections] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(-1);
  const [showSolution, setShowSolution] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [portClickState, setPortClickState] = useState<{
    nodeLabel: string;
    portName: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when step changes
  useEffect(() => {
    setConnections([]);
    setInputValue("");
    setError(null);
    setShowHint(-1);
    setShowSolution(false);
    setPortClickState(null);
    setJustConnected(false);
  }, [stage.id]);

  // Build full DSL from scaffold + user connections
  const fullDsl = buildDsl(stage.scaffold, connections);

  // Sync state to MCP preview server for check_challenge_progress
  const handleAddConnection = useCallback((connection: string) => {
    setConnections((prev) => prev.includes(connection) ? prev : [...prev, connection]);
  }, []);
  useChallengeSync(challengeId, stage.id, fullDsl, onNavigate, handleAddConnection);

  // Count connections
  const solutionConnections = countConnections(stage.solution);
  const isComplete = connections.length >= solutionConnections;

  const addConnection = useCallback(
    (conn: string) => {
      if (connections.includes(conn)) {
        setError("Already connected");
        return;
      }
      setConnections((prev) => [...prev, conn]);
      setInputValue("");
      setError(null);
      setPortClickState(null);
      // Flash feedback
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 600);
    },
    [connections]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const match = trimmed.match(
        /^connect\s+(\w+\.\w+)\s*->\s*(\w+\.\w+)$/
      );
      if (!match) {
        setError("Format: connect source.port -> target.port");
        return;
      }

      addConnection(`connect ${match[1]} -> ${match[2]}`);
    },
    [inputValue, addConnection]
  );

  const handlePortClick = useCallback(
    (nodeLabel: string, portName: string, portType: "input" | "output") => {
      const qualified = `${nodeLabel}.${portName}`;

      if (portType === "output" && !portClickState) {
        setPortClickState({ nodeLabel, portName });
        setInputValue(`connect ${qualified} -> `);
        inputRef.current?.focus();
      } else if (portType === "input" && portClickState) {
        addConnection(
          `connect ${portClickState.nodeLabel}.${portClickState.portName} -> ${qualified}`
        );
      } else if (portType === "output") {
        setPortClickState({ nodeLabel, portName });
        setInputValue(`connect ${qualified} -> `);
        inputRef.current?.focus();
      } else {
        setInputValue((prev) => {
          if (prev.includes("-> ")) return prev;
          return prev + qualified;
        });
      }
    },
    [portClickState, addConnection]
  );

  const handleUndo = useCallback(() => {
    setConnections((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setConnections([]);
    setInputValue("");
    setError(null);
    setPortClickState(null);
  }, []);

  const handleShowSolution = useCallback(() => {
    const lines = stage.solution
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("connect "));
    setConnections(lines);
    setShowSolution(true);
  }, [stage.solution]);

  const handleNextHint = useCallback(() => {
    setShowHint((h) => Math.min(h + 1, stage.hints.length - 1));
  }, [stage.hints.length]);

  return (
    <div className="space-y-4">
      {/* Objective card */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
        <h4 className="text-blue-300 font-semibold text-sm uppercase tracking-wide mb-1">
          Objective
        </h4>
        <p className="text-gray-200 text-sm">{stage.objective}</p>
      </div>

      {/* Circuit preview with glowing ports */}
      <div
        className={`transition-all duration-300 rounded-xl ${
          justConnected ? "ring-2 ring-blue-500/40" : ""
        }`}
      >
        <CircuitEmbed
          key={fullDsl}
          dsl={fullDsl}
          height={stage.height ?? 300}
          showControls
          nodePositions={stage.nodePositions}
          showPortLabels
          glowUnconnected
          onPortClick={handlePortClick}
          description={
            portClickState
              ? `Now click an input port → ${portClickState.nodeLabel}.${portClickState.portName} → ?`
              : "Click an output port to start wiring"
          }
        />
      </div>

      {/* Connection REPL */}
      <div className="space-y-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm select-none">
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setInputValue("");
                  setPortClickState(null);
                }
              }}
              placeholder="connect source.port -> target.port"
              spellCheck={false}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 font-mono text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shrink-0"
          >
            Connect
          </button>
        </form>

        {error && (
          <p className="text-red-400 text-xs font-mono pl-7 animate-shake">
            {error}
          </p>
        )}

        {connections.length === 0 && !portClickState && (
          <p className="text-gray-500 text-xs pl-7">
            Click a glowing output port to start, or type a connection directly.
          </p>
        )}
      </div>

      {/* Connection list */}
      {connections.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">
                Connections
              </span>
              {/* Mini progress bar */}
              <div className="flex gap-0.5">
                {Array.from({ length: solutionConnections }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-4 rounded-sm transition-all duration-300 ${
                      i < connections.length
                        ? "bg-green-500"
                        : "bg-gray-700"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500 tabular-nums">
                {connections.length}/{solutionConnections}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUndo}
                disabled={connections.length === 0}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-30"
              >
                Undo
              </button>
              <button
                onClick={handleReset}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="space-y-0.5">
            {connections.map((conn, i) => (
              <li
                key={i}
                className={`text-xs font-mono flex items-center gap-2 ${
                  i === connections.length - 1 && justConnected
                    ? "text-blue-300"
                    : "text-green-400/70"
                }`}
              >
                <span className="text-gray-600 select-none w-4 text-right">
                  {i + 1}
                </span>
                {conn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints + solution row */}
      <div className="flex items-start gap-3 flex-wrap">
        <button
          onClick={handleNextHint}
          disabled={showHint >= stage.hints.length - 1}
          className="text-sm px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:text-yellow-300 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {showHint < 0 ? "Need a hint?" : "Next hint"}
        </button>
        <button
          onClick={handleShowSolution}
          className="text-sm px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:text-yellow-300 hover:bg-gray-700 transition-colors shrink-0"
        >
          Show Solution
        </button>
        {showHint >= 0 && (
          <div className="text-sm text-yellow-200/80 bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-3 flex-1 min-w-[200px]">
            {stage.hints.slice(0, showHint + 1).map((hint, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {hint}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Completion celebration */}
      {isComplete && (
        <div
          className={`rounded-xl border p-6 text-center transition-all duration-500 ${
            showSolution
              ? "bg-yellow-950/20 border-yellow-800/50"
              : "bg-green-950/30 border-green-700/50"
          }`}
        >
          {showSolution ? (
            <p className="text-yellow-300 text-lg font-semibold">
              Study the solution, then try the next step on your own!
            </p>
          ) : (
            <>
              <p className="text-green-300 text-2xl font-bold mb-1">
                Circuit complete!
              </p>
              <p className="text-green-400/70 text-sm">
                Toggle the inputs and see your circuit in action.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function buildDsl(scaffold: string, connections: string[]): string {
  if (connections.length === 0) return scaffold;

  const marker = "// YOUR CODE HERE";
  const markerLine = "// Connect";

  const lines = scaffold.split("\n");
  let insertIndex = -1;

  // Find the comment block to insert after
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.includes(marker) ||
      trimmed.startsWith(markerLine)
    ) {
      insertIndex = i;
    }
    // Keep scanning to find the last comment line in the block
    if (insertIndex >= 0 && !trimmed.startsWith("//") && trimmed !== "") {
      break;
    }
  }

  if (insertIndex === -1) {
    // Fallback: insert before the last two closing braces
    const lastBrace = scaffold.lastIndexOf("}");
    const secondLast = scaffold.lastIndexOf("}", lastBrace - 1);
    const at = secondLast > 0 ? secondLast : lastBrace;
    return (
      scaffold.slice(0, at) +
      "\n    " +
      connections.join("\n    ") +
      "\n" +
      scaffold.slice(at)
    );
  }

  // Insert after the comment block
  const before = lines.slice(0, insertIndex + 1);
  const after = lines.slice(insertIndex + 1);
  const indented = connections.map((c) => "    " + c);

  return [...before, ...indented, ...after].join("\n");
}

function countConnections(dsl: string): number {
  return dsl.split("\n").filter((l) => l.trim().startsWith("connect ")).length;
}
