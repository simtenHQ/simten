/**
 * UartTxNode Component
 *
 * Renders a memory-mapped UART transmit device.
 * Nearly identical to ConsoleNode — displays accumulated text output.
 */

'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface UartTxNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function UartTxNode({ data, selected }: UartTxNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef<HTMLPreElement>(null);

  const text = (data.__uartText as string) ?? '';

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
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'UART TX'}
          </div>

          <pre
            ref={textAreaRef}
            className="w-full h-32 overflow-auto rounded border-2 border-gray-700 bg-black text-green-400 font-mono text-xs p-2 whitespace-pre-wrap break-all"
            style={{
              minWidth: '180px',
              maxHeight: '200px',
            }}
          >
            {text || <span className="text-gray-600">{'// UART output will appear here'}</span>}
          </pre>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {charCount} chars, {lineCount} lines
          </div>
        </div>
      </BaseNode>
    </>
  );
}
