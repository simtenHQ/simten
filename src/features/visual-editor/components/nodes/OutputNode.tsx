/**
 * OutputNode Component
 *
 * Renders output components like LEDs.
 * Display-only components that visualize signals.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useIRStore } from '../../stores';
import type { NodeData } from '../../utils/projection';
import { cn } from '@/lib/utils';
import { LabelEditor } from '../LabelEditor';

interface OutputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function OutputNode({ data, selected }: OutputNodeProps) {
  const updateComponent = useIRStore((state) => state.updateComponent);
  const value = data.value ?? false;
  const numericValue = data.numericValue ?? 0;
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setLabelPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setIsEditingLabel(true);
    console.log('LED Label double-clicked, editing:', true);
  }, []);

  const handleLabelSave = useCallback((newLabel: string) => {
    console.log('Saving LED label:', newLabel);
    updateComponent(data.componentId, { label: newLabel || undefined });
    setIsEditingLabel(false);
  }, [data.componentId, updateComponent]);

  const handleLabelCancel = useCallback(() => {
    console.log('Canceling LED label edit');
    setIsEditingLabel(false);
  }, []);

  // Configure input port
  const inputPorts: PortConfig[] = [];
  for (let i = 0; i < data.inputCount; i++) {
    inputPorts.push({
      index: i,
      type: 'input',
    });
  }

  // Helper function to convert number to hex string
  const toHexString = (num: number): string => {
    return num.toString(16).toUpperCase().padStart(2, '0');
  };

  // Render different display based on component type
  const renderDisplay = () => {
    if (data.componentType === 'HexDisplay') {
      const hexValue = toHexString(numericValue);
      return (
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentType}
          </div>

          {/* Hex Display */}
          <div className="flex items-center justify-center px-4 py-2 bg-black rounded border-2 border-gray-600">
            <span className="text-2xl font-mono font-bold text-green-400">{hexValue}</span>
          </div>

          {/* Decimal Value */}
          <div className="text-xs text-gray-500">
            Dec: {numericValue}
          </div>
        </div>
      );
    } else if (data.componentType === 'SevenSegment') {
      const hexDigit = (numericValue & 0xF).toString(16).toUpperCase();
      return (
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentType}
          </div>

          {/* Seven Segment Display (simplified - just show hex digit) */}
          <div className="flex items-center justify-center px-3 py-2 bg-black rounded border-2 border-gray-600">
            <span className="text-xl font-mono font-bold text-red-500">{hexDigit}</span>
          </div>

          {/* Decimal Value */}
          <div className="text-xs text-gray-500">
            Dec: {numericValue & 0xF}
          </div>
        </div>
      );
    } else {
      // LED display (default)
      return (
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentType}
          </div>

          {/* LED Circle */}
          <div
            className={cn(
              'h-10 w-10 rounded-full border-2 transition-all',
              value
                ? 'border-green-600 bg-green-400 shadow-lg shadow-green-500/50'
                : 'border-gray-400 bg-gray-200'
            )}
          >
            {/* Glow effect when on */}
            {value && (
              <div className="h-full w-full rounded-full bg-gradient-to-br from-green-300 to-green-500" />
            )}
          </div>

          {/* Value Display */}
          <div className={cn('text-xs font-semibold', value ? 'text-green-600' : 'text-gray-500')}>
            {value ? 'ON' : 'OFF'}
          </div>
        </div>
      );
    }
  };

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
      <BaseNode inputPorts={inputPorts} selected={selected} className="min-w-[80px]">
        {renderDisplay()}
      </BaseNode>
    </>
  );
}
