/**
 * ConsoleNode Component (IR v0.1)
 *
 * Renders a memory-mapped console output device.
 * Characters written to the console accumulate in a buffer and are displayed
 * as terminal-style text output.
 */

'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface ConsoleNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function ConsoleNode({ data, selected }: ConsoleNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef<HTMLPreElement>(null);

  // Extract console text from node data
  const text = (data.__consoleText as string) ?? '';

  // Auto-scroll to bottom when text changes
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [text]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setLabelPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setIsEditingLabel(true);
  }, []);

  const handleLabelSave = useCallback((newLabel: string) => {
    updateNode(data.nodeId, { label: newLabel || undefined });
    setIsEditingLabel(false);
  }, [data.nodeId, updateNode]);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  // Count lines for display
  const lineCount = text ? text.split('\n').length : 0;
  const charCount = text.length;

  return (
    <>
      {isEditingLabel && (
        <LabelEditor
          initialValue={data.label || ''}
          onSave={handleLabelSave}
          onCancel={handleLabelCancel}
          position={labelPosition}
        />
      )}
      <BaseNode
        selected={selected}
        inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
        outputPorts={data.outputNames.map((name, index) => ({ name, index, type: 'output' as const }))}
        className="min-w-[200px]"
      >
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'Console'}
          </div>

          {/* Console Output Display */}
          <pre
            ref={textAreaRef}
            className="w-full h-32 overflow-auto rounded border-2 border-gray-700 bg-black text-green-400 font-mono text-xs p-2 whitespace-pre-wrap break-all"
            style={{
              minWidth: '180px',
              maxHeight: '200px',
            }}
          >
            {text || <span className="text-gray-600">{'// Console output will appear here'}</span>}
          </pre>

          {/* Info */}
          <div className="text-xs text-gray-500">
            {charCount} chars, {lineCount} lines
          </div>
        </div>
      </BaseNode>
    </>
  );
}
