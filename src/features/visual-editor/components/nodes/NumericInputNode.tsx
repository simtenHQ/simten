/**
 * NumericInputNode Component
 *
 * Renders multi-bit numeric input components.
 * User-controllable component for testing circuits with numeric values.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useIRStore } from '../../stores';
import type { NodeData } from '../../utils/projection';
import { cn } from '@/lib/utils';
import { LabelEditor } from '../LabelEditor';

interface NumericInputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function NumericInputNode({ data, selected }: NumericInputNodeProps) {
  const updateComponent = useIRStore((state) => state.updateComponent);
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

      updateComponent(data.componentId, { value: parsedValue });
      setIsEditingValue(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingValue(false);
    }
  }, [editValue, maxValue, data.componentId, updateComponent]);

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
    updateComponent(data.componentId, { label: newLabel || undefined });
    setIsEditingLabel(false);
  }, [data.componentId, updateComponent]);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const toggleDisplayMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayMode((mode) => (mode === 'dec' ? 'hex' : 'dec'));
  }, []);

  // Configure output port
  const outputPorts: PortConfig[] = [];
  for (let i = 0; i < data.outputCount; i++) {
    outputPorts.push({
      index: i,
      type: 'output',
      value: true, // Bus signals are always "active"
    });
  }

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
      <BaseNode outputPorts={outputPorts} selected={selected} className="min-w-[120px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'Input'}
          </div>

          {/* Value Display/Edit */}
          <div className="flex flex-col items-center gap-1">
            {isEditingValue ? (
              <input
                type="text"
                value={editValue}
                onChange={handleValueChange}
                onKeyDown={handleValueKeyDown}
                onBlur={handleValueBlur}
                autoFocus
                className="w-24 px-2 py-1 text-sm text-center border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Enter value"
              />
            ) : (
              <div
                onClick={handleValueClick}
                className="group relative px-3 py-2 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                title="Click to edit value"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-mono font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                    {displayValue}
                  </span>
                </div>

                {/* Edit indicator on hover */}
                <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✎</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Display Mode Toggle and Bit Width Info */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={toggleDisplayMode}
              className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 hover:text-slate-800 transition-colors font-medium"
              title="Toggle between decimal and hexadecimal"
            >
              {displayMode === 'dec' ? 'DEC' : 'HEX'}
            </button>
            <span className="text-slate-500 font-mono">
              {width}-bit
            </span>
          </div>

          {/* Value Range Info */}
          <div className="text-xs text-slate-400 font-mono">
            0-{maxValue}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
