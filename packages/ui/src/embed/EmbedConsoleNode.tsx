"use client";

import React, { useRef, useEffect } from "react";
import { BaseNode } from "../editor/components/nodes/BaseNode";
import type { NodeData } from "../editor/utils/projection";

interface EmbedConsoleNodeProps {
  data: NodeData;
  selected?: boolean;
}

/**
 * Lightweight console node for embeds - no useCircuitStore dependency.
 * Reads text directly from data.__consoleText.
 */
export function EmbedConsoleNode({ data, selected }: EmbedConsoleNodeProps) {
  const textAreaRef = useRef<HTMLPreElement>(null);
  const text = (data.__consoleText as string) ?? (data.__uartText as string) ?? "";

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [text]);

  const lineCount = text ? text.split("\n").length : 0;
  const charCount = text.length;

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({
        name,
        index,
        type: "input" as const,
      }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: "output" as const,
      }))}
      className="min-w-[200px]"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300">
          {data.label || "Console"}
        </div>
        <pre
          ref={textAreaRef}
          className="w-full h-32 overflow-auto rounded border-2 border-gray-700 bg-black text-green-400 font-mono text-xs p-2 whitespace-pre-wrap break-all"
          style={{ minWidth: "180px", maxHeight: "200px" }}
        >
          {text || (
            <span className="text-gray-600">
              {"// Console output will appear here"}
            </span>
          )}
        </pre>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {charCount} chars, {lineCount} lines
        </div>
      </div>
    </BaseNode>
  );
}
