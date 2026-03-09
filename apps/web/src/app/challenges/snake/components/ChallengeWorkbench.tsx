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
  }, [stage.id]);

  // Build full DSL from scaffold + user connections
  const fullDsl = buildDsl(stage.scaffold, connections);

  // Sync state to MCP preview server for check_challenge_progress
  const handleAddConnection = useCallback((connection: string) => {
    setConnections((prev) => prev.includes(connection) ? prev : [...prev, connection]);
  }, []);
  useChallengeSync(challengeId, stage.id, fullDsl, onNavigate, handleAddConnection);

  // Count how many connections the solution has vs user's current
  const solutionConnections = countConnections(stage.solution);
  const isComplete = connections.length >= solutionConnections;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Validate format
      const match = trimmed.match(
        /^connect\s+(\w+\.\w+)\s*->\s*(\w+\.\w+)$/
      );
      if (!match) {
        setError(
          'Format: connect nodeA.port -> nodeB.port'
        );
        return;
      }

      // Check for duplicate
      const normalized = `connect ${match[1]} -> ${match[2]}`;
      if (connections.includes(normalized)) {
        setError("Already connected");
        return;
      }

      setConnections((prev) => [...prev, normalized]);
      setInputValue("");
      setError(null);
      setPortClickState(null);
    },
    [inputValue, connections]
  );

  const handlePortClick = useCallback(
    (nodeLabel: string, portName: string, portType: "input" | "output") => {
      const qualified = `${nodeLabel}.${portName}`;

      if (portType === "output" && !portClickState) {
        // First click: output port (source)
        setPortClickState({ nodeLabel, portName });
        setInputValue(`connect ${qualified} -> `);
        inputRef.current?.focus();
      } else if (portType === "input" && portClickState) {
        // Second click: input port (target)
        const connection = `connect ${portClickState.nodeLabel}.${portClickState.portName} -> ${qualified}`;
        if (!connections.includes(connection)) {
          setConnections((prev) => [...prev, connection]);
        }
        setInputValue("");
        setPortClickState(null);
        setError(null);
      } else if (portType === "output") {
        // Clicked another output — restart
        setPortClickState({ nodeLabel, portName });
        setInputValue(`connect ${qualified} -> `);
        inputRef.current?.focus();
      } else {
        // Clicked input first — fill it in as the target part
        setInputValue((prev) => {
          if (prev.includes("-> ")) return prev;
          return prev + qualified;
        });
      }
    },
    [portClickState, connections]
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
    // Extract connections from solution DSL
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
      {/* Objective */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
        <h4 className="text-blue-300 font-semibold text-sm uppercase tracking-wide mb-1">
          Objective
        </h4>
        <p className="text-gray-200 text-sm">{stage.objective}</p>
      </div>

      {/* Circuit preview */}
      <CircuitEmbed
        key={fullDsl}
        dsl={fullDsl}
        height={stage.height ?? 300}
        showControls
        nodePositions={stage.nodePositions}
        showPortLabels
        onPortClick={handlePortClick}
        title={stage.title}
        description={
          portClickState
            ? `Click an input port to complete: ${portClickState.nodeLabel}.${portClickState.portName} → ?`
            : "Click an output port to start a connection"
        }
      />

      {/* Connection input */}
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
          <p className="text-red-400 text-xs font-mono pl-7">{error}</p>
        )}

        {/* Hint for port clicking */}
        {connections.length === 0 && !portClickState && (
          <p className="text-gray-500 text-xs pl-7">
            Tip: click an output port (right side) then an input port (left side) to connect them, or type the connection directly.
          </p>
        )}
      </div>

      {/* Connection list */}
      {connections.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">
              Connections ({connections.length}
              {solutionConnections > 0 && `/${solutionConnections}`})
            </span>
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
                Clear All
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {connections.map((conn, i) => (
              <li
                key={i}
                className="text-xs font-mono text-green-400/80 flex items-center gap-2"
              >
                <span className="text-gray-600 select-none">{i + 1}.</span>
                {conn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints + solution */}
      <div className="flex items-start gap-3">
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
          <div className="text-sm text-yellow-200/80 bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-3 flex-1">
            {stage.hints.slice(0, showHint + 1).map((hint, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {hint}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Success state */}
      {isComplete && !showSolution && (
        <div className="bg-green-950/30 border border-green-700/50 rounded-lg p-4 text-center">
          <p className="text-green-300 text-lg font-semibold">
            Circuit complete! Move on to the next stage.
          </p>
        </div>
      )}
    </div>
  );
}

/** Insert user connections into the scaffold at the "YOUR CODE HERE" comment */
function buildDsl(scaffold: string, connections: string[]): string {
  if (connections.length === 0) return scaffold;

  const marker = "// YOUR CODE HERE";
  const markerIndex = scaffold.indexOf(marker);
  if (markerIndex === -1) {
    // No marker — append before closing braces
    const lastBrace = scaffold.lastIndexOf("}");
    const secondLastBrace = scaffold.lastIndexOf("}", lastBrace - 1);
    const insertAt = secondLastBrace > 0 ? secondLastBrace : lastBrace;
    return (
      scaffold.slice(0, insertAt) +
      "\n    " +
      connections.join("\n    ") +
      "\n" +
      scaffold.slice(insertAt)
    );
  }

  // Find end of comment block after marker
  const lines = scaffold.split("\n");
  let insertLineIndex = -1;
  let foundMarker = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(marker)) {
      foundMarker = true;
    }
    if (foundMarker && !lines[i].trim().startsWith("//") && lines[i].trim() !== "") {
      // This is the first non-comment line after the marker block
      insertLineIndex = i;
      break;
    }
    if (foundMarker && i === lines.length - 1) {
      insertLineIndex = i;
    }
  }

  if (insertLineIndex === -1) insertLineIndex = lines.length - 2;

  const before = lines.slice(0, insertLineIndex);
  const after = lines.slice(insertLineIndex);
  const indented = connections.map((c) => "    " + c);

  return [...before, ...indented, ...after].join("\n");
}

/** Count connect statements in a DSL string */
function countConnections(dsl: string): number {
  return dsl.split("\n").filter((l) => l.trim().startsWith("connect ")).length;
}
