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
      </BaseNode>
    </>
  );
}
