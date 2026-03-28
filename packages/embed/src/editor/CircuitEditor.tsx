"use client";

import { useState, useCallback, useRef } from "react";
import { CircuitEmbed } from "../CircuitEmbed";
import type { CircuitEmbedHandle } from "../CircuitEmbed";

export interface CircuitEditorProps {
  initialDsl?: string;
  height?: number | string;
  title?: string;
  description?: string;
}

const DEFAULT_DSL = `circuit MyCircuit {
  impl {
    node A: Switch
    node B: Switch
    node gate: And
    node light: Led
    connect A.out -> gate.a
    connect B.out -> gate.b
    connect gate.out -> light.in
  }
}`;

/**
 * Embeddable circuit editor — DSL code panel + live circuit preview.
 * Consumers can embed this in docs/tutorials for an interactive playground.
 */
export function CircuitEditor({
  initialDsl = DEFAULT_DSL,
  height = 500,
  title,
  description,
}: CircuitEditorProps) {
  const [dsl, setDsl] = useState(initialDsl);
  const [liveDsl, setLiveDsl] = useState(initialDsl);
  const [hasChanges, setHasChanges] = useState(false);
  const circuitRef = useRef<CircuitEmbedHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDsl(e.target.value);
    setHasChanges(true);
  }, []);

  const handleRun = useCallback(() => {
    setLiveDsl(dsl);
    setHasChanges(false);
  }, [dsl]);

  const handleReset = useCallback(() => {
    setDsl(initialDsl);
    setLiveDsl(initialDsl);
    setHasChanges(false);
  }, [initialDsl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to run
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      setLiveDsl(dsl);
      setHasChanges(false);
    }
    // Tab inserts two spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = dsl.substring(0, start) + '  ' + dsl.substring(end);
      setDsl(newValue);
      setHasChanges(true);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [dsl]);

  const numericHeight = typeof height === 'number' ? height : 500;
  const canvasHeight = numericHeight - 40; // subtract toolbar height

  return (
    <div
      className="rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden"
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 bg-gray-900/90 shrink-0">
        {title && <span className="text-sm font-semibold text-gray-200">{title}</span>}
        {description && <span className="text-xs text-gray-500 ml-1">{description}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={!hasChanges}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              hasChanges
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-gray-800 text-gray-600 cursor-default"
            }`}
          >
            Run
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs font-medium rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
          >
            Reset
          </button>
          <span className="text-[10px] text-gray-600 font-mono">
            {hasChanges ? "unsaved" : ""}
          </span>
        </div>
      </div>

      {/* Editor + Canvas */}
      <div className="flex" style={{ height: canvasHeight }}>
        {/* Code panel */}
        <div className="w-[40%] shrink-0 border-r border-gray-700/50 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={dsl}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-[12px] leading-relaxed p-4 resize-none focus:outline-none border-none"
          />
        </div>

        {/* Live preview */}
        <div className="flex-1 min-w-0">
          <CircuitEmbed
            ref={circuitRef}
            dsl={liveDsl}
            height="100%"
            showControls={true}
          />
        </div>
      </div>
    </div>
  );
}
