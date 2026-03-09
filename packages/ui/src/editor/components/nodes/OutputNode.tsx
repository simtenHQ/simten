/**
 * OutputNode Component (IR v0.1)
 *
 * Renders output components like LEDs and displays.
 * Display-only components that visualize signals.
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
import { cn } from '../../../lib/utils';
import { LabelEditor } from '../LabelEditor';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../primitives/tooltip';

interface OutputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function OutputNode({ data, selected }: OutputNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
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
  }, []);

  const handleLabelSave = useCallback((newLabel: string) => {
    updateNode(data.nodeId, { label: newLabel || undefined });
    setIsEditingLabel(false);
  }, [data.nodeId, updateNode]);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  // Configure input ports using port names
  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  // Helper function to convert number to hex string
  const toHexString = (num: number): string => {
    return num.toString(16).toUpperCase().padStart(2, '0');
  };

  // Render different display based on component type
  const renderDisplay = () => {
    if (data.componentRef === 'HexDisplay') {
      const hexValue = toHexString(numericValue);
      return (
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentRef}
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
    } else if (data.componentRef === 'SevenSegment') {
      const hexDigit = (numericValue & 0xF).toString(16).toUpperCase();
      return (
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentRef}
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
            {data.label || data.componentRef}
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
      <BaseNode inputPorts={inputPorts} selected={selected} className="min-w-[80px]" showPortLabels={data.showPortLabels} onPortClick={data.onPortClick} glowUnconnected={data.glowUnconnected}>
        <div className="relative">
          {/* Composite badge */}
          {data.isComposite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[8px] text-white">
                  &#x229E;
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">Double-click to inspect internals</p>
              </TooltipContent>
            </Tooltip>
          )}
          {renderDisplay()}
        </div>
      </BaseNode>
    </>
  );
}
