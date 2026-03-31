"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import type { CircuitEmbedHandle, CheckResult } from "@turing-incomplete/embed";

interface Check {
  description: string;
  node: string;
  port: string;
  expected: number;
  inputs?: [string, number][];
  ticks?: number;
}

interface InlineChallengeProps {
  title: string;
  objective: string;
  hints: string[];
  scaffold: string;
  checks: Check[];
  height?: number;
  onPass?: () => void;
  nodePositions?: Record<string, { x: number; y: number }>;
}

export function InlineChallenge({
  title,
  objective,
  hints,
  scaffold,
  checks,
  height = 280,
  onPass,
  nodePositions,
}: InlineChallengeProps) {
  const [code, setCode] = useState(scaffold);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [passed, setPassed] = useState(false);
  const [hintIndex, setHintIndex] = useState(-1);
  const [compileError, setCompileError] = useState<string | null>(null);
  const circuitRef = useRef<CircuitEmbedHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allPassed = results !== null && results.every((r) => r.passed);

  useEffect(() => {
    if (allPassed && !passed) {
      setPassed(true);
      onPass?.();
    }
  }, [allPassed, passed, onPass]);

  const handleCheck = useCallback(() => {
    if (!circuitRef.current) return;
    setCompileError(null);
    try {
      const r = circuitRef.current.runChecks(checks);
      setResults(r);
    } catch (e: unknown) {
      setCompileError(e instanceof Error ? e.message : "Compilation error");
      setResults(null);
    }
  }, [checks]);

  const handleReset = useCallback(() => {
    setCode(scaffold);
    setResults(null);
    setCompileError(null);
    setPassed(false);
    setHintIndex(-1);
  }, [scaffold]);

  return (
    <div className="my-8 rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${passed ? "bg-emerald-400" : "bg-amber-400"}`} />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          {passed && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
              Passed
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{objective}</p>
      </div>

      {/* Editor + Circuit side by side */}
      <div className="flex flex-col lg:flex-row">
        {/* Code editor */}
        <div className="lg:w-[45%] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800/50">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setResults(null);
              setCompileError(null);
            }}
            spellCheck={false}
            className="w-full bg-transparent text-gray-500 dark:text-gray-300 font-mono text-[12px] leading-relaxed p-4 resize-none focus:outline-none"
            style={{ minHeight: height }}
          />
        </div>

        {/* Live circuit preview */}
        <div className="lg:flex-1 min-h-0">
          <CircuitEmbed
            ref={circuitRef}
            dsl={code}
            height={height}
            showControls={true}
            nodePositions={nodePositions}
          />
        </div>
      </div>

      {/* Results + controls */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800/50 space-y-3">
        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheck}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              passed
                ? "bg-emerald-800/50 text-emerald-300 cursor-default"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
            disabled={passed}
          >
            {passed ? "Passed!" : "Check"}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:bg-gray-800 transition-colors"
          >
            Reset
          </button>
          {!passed && hintIndex < hints.length - 1 && (
            <button
              onClick={() => setHintIndex((h) => h + 1)}
              className="px-3 py-1.5 rounded-md text-sm text-amber-500/70 hover:text-amber-400 hover:bg-amber-900/20 transition-colors ml-auto"
            >
              Hint ({hintIndex + 1}/{hints.length})
            </button>
          )}
        </div>

        {/* Compile error */}
        {compileError && (
          <div className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-3 py-2 border border-red-900/30">
            {compileError}
          </div>
        )}

        {/* Check results */}
        {results && !allPassed && (
          <div className="space-y-1">
            {results.map((r, i) => (
              <div
                key={i}
                className={`text-xs font-mono px-3 py-1.5 rounded ${
                  r.passed
                    ? "text-emerald-400 bg-emerald-950/20"
                    : "text-red-400 bg-red-950/20"
                }`}
              >
                {r.passed ? "\u2713" : "\u2717"} {r.description}
                {!r.passed && (
                  <span className="text-gray-500 ml-2">
                    (got {String(r.actual)}, expected {r.expected})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hints */}
        {hintIndex >= 0 && (
          <div className="space-y-1.5">
            {hints.slice(0, hintIndex + 1).map((hint, i) => (
              <div
                key={i}
                className="text-xs text-amber-300/70 bg-amber-950/20 rounded px-3 py-2 border border-amber-900/20"
              >
                {hint}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
