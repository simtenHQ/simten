
import { useRef, useEffect, useState, useCallback } from "react";
import { use6502Simulator } from "./use6502Simulator";
import { useCC65Compiler } from "./useCC65Compiler";
import type { StageStatus } from "@/lib/cc65-compiler";

const STARTER_TEMPLATE = `\
/*
 * Write C code for the 6502 simulator.
 * Console output: write bytes to address $F000
 * No stdlib available — use the CONSOLE macro.
 */
#define CONSOLE (*(volatile unsigned char*)0xF000)

void main(void) {
    CONSOLE = 'H';
    CONSOLE = 'i';
    CONSOLE = '!';
    CONSOLE = '\\n';

    while(1);  /* halt */
}
`;

function StageIndicator({ label, status }: { label: string; status: StageStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono ${
        status === "done"
          ? "text-green-400"
          : status === "error"
            ? "text-red-400"
            : status === "running"
              ? "text-blue-400"
              : "text-gray-500"
      }`}
    >
      {status === "running" && (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
      )}
      {status === "done" && "✓"}
      {status === "error" && "✗"}
      {status === "pending" && "○"}
      {label}
    </span>
  );
}

export function CPU6502Demo() {
  const {
    loading,
    loadError,
    sim,
    consoleText,
    currentProgram,
    sourceCode,
    programs,
    selectProgram,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
    loadCustomBinary,
  } = use6502Simulator();

  const compiler = useCC65Compiler();
  const consoleRef = useRef<HTMLPreElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorSource, setEditorSource] = useState(STARTER_TEMPLATE);
  const autoRunRef = useRef(false);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleText]);

  // Auto-start running after compile → load → simulator rebuild
  useEffect(() => {
    if (autoRunRef.current && sim.ready) {
      autoRunRef.current = false;
      setIsRunning(true);
    }
  }, [sim.ready, setIsRunning]);

  const handleEnterEditMode = useCallback(async () => {
    setEditMode(true);
    // Start loading WASM modules eagerly
    compiler.loadWasm();
  }, [compiler]);

  const handleExitEditMode = useCallback(() => {
    setEditMode(false);
    compiler.errors.length > 0; // clear by going back
  }, [compiler.errors.length]);

  const handleCompileAndRun = useCallback(async () => {
    setIsRunning(false);
    const result = await compiler.compile(editorSource);
    if (result.success && result.binary) {
      autoRunRef.current = true; // auto-start when simulator rebuilds
      loadCustomBinary(result.binary, editorSource);
    }
  }, [compiler, editorSource, loadCustomBinary, setIsRunning]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6">
        <div className="text-red-400 text-sm font-mono">{loadError}</div>
      </div>
    );
  }

  if (loading || !sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <div>
            <span className="text-sm">
              {loading
                ? "Loading 6502 system (5,574 lines of DSL)..."
                : "Compiling 6502 CPU..."}
            </span>
            {!loading && (
              <span className="block text-xs text-gray-500 dark:text-gray-500 mt-1">
                This may take a few seconds
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
      {/* Header bar: program selector OR compile controls */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex flex-wrap items-center gap-3">
        {editMode ? (
          <>
            <button
              onClick={handleCompileAndRun}
              disabled={compiler.compiling}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              {compiler.compiling ? "Compiling..." : "Compile & Run"}
            </button>
            {compiler.compiling && (
              <div className="flex items-center gap-2">
                <StageIndicator label="cc65" status={compiler.stages.cc65} />
                <span className="text-gray-600">→</span>
                <StageIndicator label="ca65" status={compiler.stages.ca65} />
                <span className="text-gray-600">→</span>
                <StageIndicator label="ld65" status={compiler.stages.ld65} />
              </div>
            )}
            <button
              onClick={handleExitEditMode}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-700 transition-colors ml-auto"
            >
              Back to Examples
            </button>
          </>
        ) : (
          <>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Program
            </label>
            <div className="flex gap-2">
              {programs.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => selectProgram(prog.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    currentProgram.id === prog.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {prog.name}
                </button>
              ))}
            </div>
            <button
              onClick={handleEnterEditMode}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-700 transition-colors ml-auto"
            >
              Edit Code
            </button>
          </>
        )}
      </div>

      {/* Main content: console + source/editor side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700/50">
        {/* Console output */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Console Output
          </div>
          <pre
            ref={consoleRef}
            className="h-48 overflow-auto rounded-lg border border-gray-700 bg-black text-green-400 font-mono text-sm p-3 whitespace-pre-wrap"
          >
            {consoleText || (
              <span className="text-gray-600">
                {editMode
                  ? "// Click Compile & Run to execute your code"
                  : "// Click Run to start the program"}
              </span>
            )}
          </pre>
        </div>

        {/* C source / editor */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {editMode ? "C Editor" : `C Source (${currentProgram.name})`}
          </div>

          {editMode ? (
            <div className="space-y-2">
              <textarea
                value={editorSource}
                onChange={(e) => setEditorSource(e.target.value)}
                spellCheck={false}
                className="h-48 w-full resize-none rounded-lg border border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-300 font-mono text-xs p-3 leading-relaxed focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              {compiler.errors.length > 0 && (
                <pre className="max-h-24 overflow-auto rounded-lg border border-red-800/50 bg-red-950/30 text-red-400 font-mono text-xs p-3">
                  {compiler.errors.join("\n")}
                </pre>
              )}
              <div className="text-[10px] text-gray-500 dark:text-gray-500 leading-snug">
                No standard library (printf, etc.) — use{" "}
                <code className="text-gray-500 dark:text-gray-400">CONSOLE = &apos;c&apos;;</code> for output.
                Program must end with <code className="text-gray-500 dark:text-gray-400">while(1);</code> to
                halt. ROM size: 16KB max.
              </div>
            </div>
          ) : (
            <pre className="h-48 overflow-auto rounded-lg border border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-300 font-mono text-xs p-3 leading-relaxed">
              {sourceCode}
            </pre>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-gray-900/90">
        {/* Run/Pause */}
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-gray-900 dark:text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
        >
          {isRunning ? "Pause" : "Run"}
        </button>

        {/* Step */}
        <button
          onClick={sim.tick}
          disabled={isRunning}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
        >
          Step
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Reset
        </button>

        {/* Speed slider */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500 dark:text-gray-400">Speed</label>
          <input
            type="range"
            min={1}
            max={100}
            value={101 - speed}
            onChange={(e) => setSpeed(101 - Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
        </div>

        {/* Cycle counter */}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
          Cycle {sim.cycleCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
