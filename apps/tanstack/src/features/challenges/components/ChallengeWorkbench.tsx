"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import type { CircuitEmbedHandle, CheckResult } from "@turing-incomplete/ui/embed";
import type { ChallengeStage } from "@turing-incomplete/challenges";
import { checkProgress } from "@turing-incomplete/challenges";
import { DSLEditor, type DSLEditorRef } from "@/features/dsl/ui/DSLEditor";
import { useChallengeSync } from "../useChallengeSync";
import { McpStatusBadge } from "@/features/mcp/McpStatusBadge";

interface ChallengeWorkbenchProps {
  stage: ChallengeStage;
  challengeId: string;
  onNavigate: (stageId: string) => void;
  nextStageId?: string | null;
  onStageComplete?: (stageId: string) => void;
}

export function ChallengeWorkbench({ stage, challengeId, onNavigate, nextStageId, onStageComplete }: ChallengeWorkbenchProps) {
  const editorStorageKey = `ti:${challengeId}:${stage.id}:dsl`;
  const editorRef = useRef<DSLEditorRef>(null);
  const circuitRef = useRef<CircuitEmbedHandle>(null);

  // Track the current DSL code from the editor (for progress checking)
  const [dslCode, setDslCode] = useState(stage.scaffold);
  // Last successfully compiled DSL — fed to CircuitEmbed so circuit doesn't
  // disappear while the user is mid-typing
  const [lastGoodDsl, setLastGoodDsl] = useState(stage.scaffold);
  const [showHint, setShowHint] = useState(-1);
  const [showSolution, setShowSolution] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);

  // Reset state when stage changes
  useEffect(() => {
    setShowHint(-1);
    setShowSolution(false);
    setCheckResults(null);
    // Load saved code or use scaffold
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(editorStorageKey);
      const code = saved || stage.scaffold;
      setDslCode(code);
      setLastGoodDsl(code);
    } else {
      setDslCode(stage.scaffold);
      setLastGoodDsl(stage.scaffold);
    }
  }, [stage.id, editorStorageKey, stage.scaffold]);

  // Correctness-based completion — check against last good compile,
  // not raw editor text, so progress doesn't drop while typing
  const progress = useMemo(
    () => checkProgress(lastGoodDsl, stage.solution),
    [lastGoodDsl, stage.solution]
  );
  const isComplete = progress.complete;

  // Fire completion callback
  const prevCompleteRef = useRef(false);
  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      onStageComplete?.(stage.id);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete, stage.id, onStageComplete]);

  // MCP sync — handle navigation and external step additions
  const handleAddStep = useCallback((step: string) => {
    // When MCP adds a connection, append it to the editor
    const editor = editorRef.current;
    if (!editor) return;
    const currentCode = editor.getCode();
    // Insert the connect line before the last closing braces
    const lastBrace = currentCode.lastIndexOf("}");
    const secondLast = currentCode.lastIndexOf("}", lastBrace - 1);
    const insertAt = secondLast > 0 ? secondLast : lastBrace;
    const newCode = currentCode.slice(0, insertAt) + "    " + step + "\n" + currentCode.slice(insertAt);
    editor.setCode(newCode);
    setDslCode(newCode);
  }, []);

  const mcpStatus = useChallengeSync(challengeId, stage.id, dslCode, onNavigate, handleAddStep);

  const handleCodeChange = useCallback((code: string) => {
    setDslCode(code);
    setCheckResults(null);
  }, []);

  const handleCompileSuccess = useCallback((_circuits: unknown, compiledDsl: string) => {
    setLastGoodDsl(compiledDsl);
  }, []);

  const handleRunChecks = useCallback(() => {
    if (!circuitRef.current || !stage.checks) return;
    const results = circuitRef.current.runChecks(stage.checks);
    setCheckResults(results);
  }, [stage.checks]);

  const handleShowSolution = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCode(stage.solution);
    setDslCode(stage.solution);
    setLastGoodDsl(stage.solution);
    setShowSolution(true);
  }, [stage.solution]);

  const handleReset = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCode(stage.scaffold);
    setDslCode(stage.scaffold);
    setLastGoodDsl(stage.scaffold);
    setShowSolution(false);
    setCheckResults(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(editorStorageKey);
    }
  }, [stage.scaffold, editorStorageKey]);

  const handleNextHint = useCallback(() => {
    setShowHint((h) => Math.min(h + 1, stage.hints.length - 1));
  }, [stage.hints.length]);

  const handleNextStage = useCallback(() => {
    if (nextStageId) onNavigate(nextStageId);
  }, [nextStageId, onNavigate]);

  return (
    <div className="space-y-4">
      {/* Objective card */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-blue-300 font-semibold text-sm uppercase tracking-wide">
            Objective
          </h4>
          <McpStatusBadge status={mcpStatus} />
        </div>
        <p className="text-gray-200 text-sm">{stage.objective}</p>
      </div>

      {/* Side-by-side: Editor + Circuit */}
      <div className="flex gap-4" style={{ height: stage.height ?? 400 }}>
        {/* DSL Editor */}
        <div className="w-1/2 rounded-lg overflow-hidden border border-gray-700">
          <DSLEditor
            key={stage.id}
            ref={editorRef}
            storageKey={editorStorageKey}
            initialCode={stage.scaffold}
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

        {/* Circuit preview */}
        <div className="w-1/2 min-h-0">
          <CircuitEmbed
            ref={circuitRef}
            dsl={lastGoodDsl}
            height={stage.height ?? 400}
            showControls
            nodePositions={stage.nodePositions}
            showPortLabels
          />
        </div>
      </div>

      {/* Progress bar */}
      {progress.totalExpected > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">Progress</span>
          <div className="flex gap-0.5">
            {Array.from({ length: progress.totalExpected }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-4 rounded-sm transition-all duration-300 ${
                  i < progress.correct ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 tabular-nums">
            {progress.correct}/{progress.totalExpected}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleReset}
              className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Test Circuit button */}
      {stage.checks && stage.checks.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={handleRunChecks}
            className="text-sm px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
          >
            Test Circuit
          </button>
          {checkResults && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-400">Test Results</span>
                <span className="text-xs tabular-nums text-gray-500">
                  {checkResults.filter(r => r.passed).length}/{checkResults.length} passed
                </span>
              </div>
              {checkResults.map((result, i) => (
                <div
                  key={i}
                  className={`text-xs font-mono flex items-center gap-2 ${
                    result.passed ? "text-green-400" : "text-red-400"
                  }`}
                >
                  <span>{result.passed ? "PASS" : "FAIL"}</span>
                  <span className="text-gray-400">
                    {result.description ?? `Check ${i + 1}`}
                  </span>
                  {!result.passed && (
                    <span className="text-red-400/70">
                      (expected {result.expected}, got {String(result.actual)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
            {stage.hints.slice(0, showHint + 1).map((hint: string, i: number) => (
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
          {nextStageId && !showSolution && (
            <button
              onClick={handleNextStage}
              className="mt-4 px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
            >
              Next Stage →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
