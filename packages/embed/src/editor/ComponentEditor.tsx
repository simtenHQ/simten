"use client";

import { useState, useCallback, useRef } from "react";
import { ComponentEmbed } from "../ComponentEmbed";
import type { ComponentEmbedHandle } from "../ComponentEmbed";

export interface ComponentEditorProps {
  initialCode?: string;
  height?: number | string;
  title?: string;
  description?: string;
  theme?: "light" | "dark";
}

const DEFAULT_CODE = `const MyCircuit = component('MyCircuit', {
  nodes: { A: Switch, B: Switch, gate: And, light: Led },
  connect: ({ A, B, gate, light }) => [
    A.out.to(gate.a),
    B.out.to(gate.b),
    gate.out.to(light.in),
  ],
})`;

/**
 * Embeddable circuit editor — DSL code panel + live circuit preview.
 * Consumers can embed this in docs/tutorials for an interactive playground.
 */
export function ComponentEditor({
  initialCode = DEFAULT_CODE,
  height = 500,
  title,
  description,
  theme = "dark",
}: ComponentEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [liveCode, setLiveCode] = useState(initialCode);
  const [hasChanges, setHasChanges] = useState(false);
  const circuitRef = useRef<ComponentEmbedHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setHasChanges(true);
  }, []);

  const handleRun = useCallback(() => {
    setLiveCode(code);
    setHasChanges(false);
  }, [code]);

  const handleReset = useCallback(() => {
    setCode(initialCode);
    setLiveCode(initialCode);
    setHasChanges(false);
  }, [initialCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to run
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      setLiveCode(code);
      setHasChanges(false);
    }
    // Tab inserts two spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newValue);
      setHasChanges(true);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [code]);

  const numericHeight = typeof height === 'number' ? height : 500;
  const canvasHeight = numericHeight - 40; // subtract toolbar height

  return (
    <div
      data-embed-theme={theme}
      className="rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-surface-80)] overflow-hidden"
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--embed-border)] bg-[var(--embed-bg-surface)] shrink-0">
        {title && <span className="text-sm font-semibold text-[var(--embed-text-primary)]">{title}</span>}
        {description && <span className="text-xs text-[var(--embed-text-muted)] ml-1">{description}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={!hasChanges}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              hasChanges
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-[var(--embed-bg-tertiary)] text-[var(--embed-text-muted)] cursor-default"
            }`}
          >
            Run
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs font-medium rounded-md bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-secondary)] transition-colors"
          >
            Reset
          </button>
          <span className="text-[10px] text-[var(--embed-text-muted)] font-mono">
            {hasChanges ? "unsaved" : ""}
          </span>
        </div>
      </div>

      {/* Editor + Canvas */}
      <div className="flex" style={{ height: canvasHeight }}>
        {/* Code panel */}
        <div className="w-[40%] shrink-0 border-r border-[var(--embed-border)] overflow-hidden">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full bg-[var(--embed-bg-code)] text-[var(--embed-text-primary)] font-mono text-[12px] leading-relaxed p-4 resize-none focus:outline-none border-none"
          />
        </div>

        {/* Live preview */}
        <div className="flex-1 min-w-0">
          <ComponentEmbed
            ref={circuitRef}
            code={liveCode}
            height="100%"
            showControls={true}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
}
