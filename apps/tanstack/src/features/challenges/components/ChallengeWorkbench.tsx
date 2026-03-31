"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { CircuitEmbed } from "@turing-incomplete/embed";
import type { CircuitEmbedHandle, CheckResult } from "@turing-incomplete/embed";
import type { ChallengeLevel } from "@turing-incomplete/challenges";
import { checkProgress } from "@turing-incomplete/challenges";
import { DSLEditor, type DSLEditorRef } from "@/features/dsl/ui/DSLEditor";
import { useChallengeSync } from "../useChallengeSync";
import { McpStatusBadge } from "@/features/mcp/McpStatusBadge";
import { useComponentLibraryStore } from "@turing-incomplete/ui/editor/stores";
import { parseDSL, compileCircuitToIR } from "@turing-incomplete/core/dsl";

interface ChallengeWorkbenchProps {
  level: ChallengeLevel;
  challengeId: string;
  challengeTitle: string;
  levelIndex: number;
  completedLevels: Set<string>;
  levels: ChallengeLevel[];
  onNavigate: (levelId: string) => void;
  onLevelSelect: (index: number) => void;
  nextLevelId?: string | null;
  onLevelComplete?: (levelId: string) => void;
}

export function ChallengeWorkbench({
  level, challengeId, challengeTitle, levelIndex,
  completedLevels, levels, onNavigate, onLevelSelect, nextLevelId, onLevelComplete,
}: ChallengeWorkbenchProps) {
  const editorStorageKey = `ti:${challengeId}:${level.id}:dsl`;
  const editorRef = useRef<DSLEditorRef>(null);
  const circuitRef = useRef<CircuitEmbedHandle>(null);

  // Register preamble composites in the component library so both
  // the editor and canvas recognize them as components (rendered as single blocks).
  const { registerUser, resolveComponent } = useComponentLibraryStore();
  useEffect(() => {
    if (!level.preamble) return;
    const { ast, errors } = parseDSL(level.preamble, 'challenge-preamble');
    if (errors.length > 0) return;
    for (const circuitDef of ast.circuits) {
      const library = {
        getCircuit: (name: string) => resolveComponent(name),
        hasCircuit: (name: string) => resolveComponent(name) !== undefined,
        getAllComponentNames: () => [],
      };
      try {
        const circuit = compileCircuitToIR(circuitDef, library);
        registerUser(circuit);
      } catch { /* preamble compile error — skip */ }
    }
  }, [level.preamble, level.id, registerUser, resolveComponent]);

  // Track the current DSL code from the editor (for progress checking)
  const [dslCode, setDslCode] = useState(level.scaffold);
  // Last successfully compiled DSL — fed to CircuitEmbed so circuit doesn't
  // disappear while the user is mid-typing
  const [lastGoodDsl, setLastGoodDsl] = useState(level.scaffold);
  const [showHint, setShowHint] = useState(-1);
  const [showSolution, setShowSolution] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);
  const [infoPanelCollapsed, setInfoPanelCollapsed] = useState(false);

  // Reset state when level changes
  useEffect(() => {
    setShowHint(-1);
    setShowSolution(false);
    setCheckResults(null);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(editorStorageKey);
      const code = saved || level.scaffold;
      setDslCode(code);
      setLastGoodDsl(code);
    } else {
      setDslCode(level.scaffold);
      setLastGoodDsl(level.scaffold);
    }
  }, [level.id, editorStorageKey, level.scaffold]);

  // Correctness-based completion
  const progress = useMemo(
    () => checkProgress(lastGoodDsl, level.solution),
    [lastGoodDsl, level.solution]
  );
  const isComplete = progress.complete;

  // Fire completion callback
  const prevCompleteRef = useRef(false);
  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      onLevelComplete?.(level.id);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete, level.id, onLevelComplete]);

  // MCP sync
  const handleAddStep = useCallback((step: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentCode = editor.getCode();
    const lastBrace = currentCode.lastIndexOf("}");
    const secondLast = currentCode.lastIndexOf("}", lastBrace - 1);
    const insertAt = secondLast > 0 ? secondLast : lastBrace;
    const newCode = currentCode.slice(0, insertAt) + "    " + step + "\n" + currentCode.slice(insertAt);
    editor.setCode(newCode);
    setDslCode(newCode);
  }, []);

  const mcpStatus = useChallengeSync(challengeId, level.id, dslCode, onNavigate, handleAddStep);

  const handleCodeChange = useCallback((code: string) => {
    setDslCode(code);
    setCheckResults(null);
  }, []);

  const handleCompileSuccess = useCallback((_circuits: unknown, compiledDsl: string) => {
    setLastGoodDsl(compiledDsl);
  }, []);

  const handleRunChecks = useCallback(() => {
    if (!circuitRef.current || !level.checks) return;
    const results = circuitRef.current.runChecks(level.checks);
    setCheckResults(results);
  }, [level.checks]);

  const handleShowSolution = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCode(level.solution);
    setDslCode(level.solution);
    setLastGoodDsl(level.solution);
    setShowSolution(true);
  }, [level.solution]);

  const handleReset = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCode(level.scaffold);
    setDslCode(level.scaffold);
    setLastGoodDsl(level.scaffold);
    setShowSolution(false);
    setCheckResults(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(editorStorageKey);
    }
  }, [level.scaffold, editorStorageKey]);

  const handleNextHint = useCallback(() => {
    setShowHint((h) => Math.min(h + 1, level.hints.length - 1));
  }, [level.hints.length]);

  const handleNextLevel = useCallback(() => {
    if (nextLevelId) onNavigate(nextLevelId);
  }, [nextLevelId, onNavigate]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-gray-100">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-gray-900 px-4 py-2">
        <a href="/challenges" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Challenges
        </a>
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-sm font-semibold text-gray-200">{challengeTitle}</span>
        <div className="h-4 w-px bg-gray-700" />

        {/* Level tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {levels.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onLevelSelect(i)}
              className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                i === levelIndex
                  ? "bg-blue-600 text-white"
                  : completedLevels.has(l.id)
                  ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
              }`}
              title={l.title}
            >
              {completedLevels.has(l.id) ? "✓" : i + 1}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <McpStatusBadge status={mcpStatus} />
      </div>

      {/* Main content: left panel + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: info + editor */}
        <div className="w-[40%] flex flex-col border-r border-gray-800">
          {/* Challenge info (collapsible) */}
          {!infoPanelCollapsed && (
            <div className="shrink-0 overflow-y-auto max-h-[45%] border-b border-gray-800">
              <div className="p-4 space-y-3">
                {/* Level title */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">
                    Level {levelIndex + 1}: {level.title}
                  </h2>
                  <button
                    onClick={() => setInfoPanelCollapsed(true)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                    title="Collapse"
                  >
                    ▴
                  </button>
                </div>

                {/* Concept */}
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {level.concept}
                </p>

                {/* Objective */}
                <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3">
                  <h4 className="text-blue-300 font-semibold text-xs uppercase tracking-wide mb-1">
                    Objective
                  </h4>
                  <p className="text-gray-200 text-sm">{level.objective}</p>
                </div>

                {/* Progress bar */}
                {progress.totalExpected > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5 flex-1">
                      {Array.from({ length: progress.totalExpected }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-sm transition-all duration-300 ${
                            i < progress.correct ? "bg-green-500" : "bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums shrink-0">
                      {progress.correct}/{progress.totalExpected}
                    </span>
                  </div>
                )}

                {/* Hints */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNextHint}
                    disabled={showHint >= level.hints.length - 1}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-yellow-300 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {showHint < 0 ? "Hint" : "Next hint"}
                  </button>
                  <button
                    onClick={handleShowSolution}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-yellow-300 hover:bg-gray-700 transition-colors"
                  >
                    Solution
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    Reset
                  </button>
                  {level.checks && level.checks.length > 0 && (
                    <button
                      onClick={handleRunChecks}
                      className="text-xs px-2 py-1 rounded bg-purple-700 text-purple-100 hover:bg-purple-600 transition-colors"
                    >
                      Test
                    </button>
                  )}
                </div>

                {/* Hint content */}
                {showHint >= 0 && (
                  <div className="text-xs text-yellow-200/80 bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-2.5 space-y-1">
                    {level.hints.slice(0, showHint + 1).map((hint: string, i: number) => (
                      <p key={i}>{hint}</p>
                    ))}
                  </div>
                )}

                {/* Check results */}
                {checkResults && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400">Tests</span>
                      <span className="text-xs tabular-nums text-gray-500">
                        {checkResults.filter(r => r.passed).length}/{checkResults.length}
                      </span>
                    </div>
                    {checkResults.map((result, i) => (
                      <div
                        key={i}
                        className={`text-xs font-mono flex items-center gap-1.5 ${
                          result.passed ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        <span>{result.passed ? "✓" : "✗"}</span>
                        <span className="text-gray-400">{result.description ?? `Check ${i + 1}`}</span>
                        {!result.passed && (
                          <span className="text-red-400/70">(got {String(result.actual)})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Completion */}
                {isComplete && (
                  <div
                    className={`rounded-lg border p-3 text-center ${
                      showSolution
                        ? "bg-yellow-950/20 border-yellow-800/50"
                        : "bg-green-950/30 border-green-700/50"
                    }`}
                  >
                    {showSolution ? (
                      <p className="text-yellow-300 text-sm font-semibold">Study the solution, then try the next level!</p>
                    ) : (
                      <p className="text-green-300 text-sm font-bold">Circuit complete!</p>
                    )}
                    {nextLevelId && !showSolution && (
                      <button
                        onClick={handleNextLevel}
                        className="mt-2 px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                      >
                        Next Level →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed info bar */}
          {infoPanelCollapsed && (
            <div className="shrink-0 flex items-center gap-2 border-b border-gray-800 px-4 py-1.5">
              <button
                onClick={() => setInfoPanelCollapsed(false)}
                className="text-xs text-gray-500 hover:text-gray-300 px-1"
                title="Expand"
              >
                ▾
              </button>
              <span className="text-xs text-gray-400 font-medium">
                Level {levelIndex + 1}: {level.title}
              </span>
              {progress.totalExpected > 0 && (
                <span className="text-xs tabular-nums text-gray-600">
                  {progress.correct}/{progress.totalExpected}
                </span>
              )}
              {isComplete && <span className="text-xs text-green-400 font-medium">Complete</span>}
            </div>
          )}

          {/* DSL Editor (fills remaining space) */}
          <div className="flex-1 min-h-0">
            <DSLEditor
              key={level.id}
              ref={editorRef}
              storageKey={editorStorageKey}
              initialCode={level.scaffold}
              autoCompileEnabled
              showHeader={false}
              onCodeChange={handleCodeChange}
              onCompileSuccess={handleCompileSuccess}
              editorOptions={{
                fontSize: 13,
                lineNumbers: "on",
              }}
            />
          </div>
        </div>

        {/* Right: Canvas */}
        <div className="flex-1 min-h-0">
          <CircuitEmbed
            ref={circuitRef}
            dsl={lastGoodDsl}
            height="100%"
            showControls
            nodePositions={level.nodePositions}
            showPortLabels
          />
        </div>
      </div>
    </div>
  );
}
