/**
 * NumericInputNode Component (IR v0.1)
 *
 * Renders multi-bit numeric input components.
 * User-controllable component for testing circuits with numeric values.
 *
 * Updated for IR v0.1:
 * - Uses CircuitStore instead of useIRStore
 * - Uses name-based ports instead of index-based
 * - Uses data.nodeId instead of data.componentId
 * - Uses data.componentRef instead of data.componentType
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface NumericInputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function NumericInputNode({ data, selected }: NumericInputNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const value = data.numericValue ?? 0;
  const width = data.width ?? 8;
  const maxValue = (1 << width) - 1;

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [displayMode, setDisplayMode] = useState<'dec' | 'hex'>('dec');

  const handleValueClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value.toString());
    setIsEditingValue(true);
  }, [value]);

  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleValueKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      let parsedValue: number;
      const trimmedValue = editValue.trim();

      // Try to parse as hex if it starts with 0x
      if (trimmedValue.toLowerCase().startsWith('0x')) {
        parsedValue = parseInt(trimmedValue, 16);
      } else {
        parsedValue = parseInt(trimmedValue, 10);
      }

      // Validate and clamp value
      if (isNaN(parsedValue)) {
        parsedValue = 0;
      } else {
        parsedValue = Math.max(0, Math.min(maxValue, parsedValue));
      }

      // Use custom callback if provided (e.g., from Inspector dialog)
      if (data.onValueChange) {
        data.onValueChange(parsedValue);
      } else {
        // Otherwise update the node's arguments.value via circuit store
        const currentNode = useCircuitStore.getState().getNode(data.nodeId);
        if (currentNode) {
          updateNode(data.nodeId, {
            arguments: { ...currentNode.arguments, value: parsedValue },
          });
        }
      }
      setIsEditingValue(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingValue(false);
    }
  }, [editValue, maxValue, data.nodeId, updateNode]);

  const handleValueBlur = useCallback(() => {
    setIsEditingValue(false);
  }, []);

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

  const toggleDisplayMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayMode((mode) => (mode === 'dec' ? 'hex' : 'dec'));
  }, []);

  // Configure output ports using port names
  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value: true, // Bus signals are always "active"
  }));

  // Format value for display
  const displayValue = displayMode === 'hex'
    ? `0x${value.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0')}`
    : value.toString();

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
      <BaseNode outputPorts={outputPorts} selected={selected} className="min-w-[100px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentRef}
          </div>

          {/* Value Display/Editor */}
          <div className="flex flex-col items-center gap-1">
            {isEditingValue ? (
              <input
                type="text"
                value={editValue}
                onChange={handleValueChange}
                onKeyDown={handleValueKeyDown}
                onBlur={handleValueBlur}
                className="w-24 px-2 py-1 text-center font-mono text-sm border-2 border-blue-500 rounded focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                onClick={handleValueClick}
                className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded cursor-pointer hover:shadow-md transition-all font-mono text-sm"
                title="Click to edit value"
              >
                {displayValue}
              </div>
            )}

            {/* Display mode toggle */}
            <button
              onClick={toggleDisplayMode}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Toggle decimal/hex display"
            >
              {displayMode === 'dec' ? 'DEC' : 'HEX'}
            </button>
          </div>

          {/* Bit width indicator */}
          <div className="text-xs text-gray-400 dark:text-gray-500">{width}-bit</div>
        </div>
      </BaseNode>
    </>
  );
}
