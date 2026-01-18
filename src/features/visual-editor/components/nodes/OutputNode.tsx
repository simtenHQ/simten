/**
 * OutputNode Component
 *
 * Renders output components like LEDs.
 * Display-only components that visualize signals.
 */

import React from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import type { NodeData } from '../../utils/projection';
import { cn } from '@/lib/utils';

interface OutputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function OutputNode({ data, selected }: OutputNodeProps) {
  const value = data.value ?? false;

  // Configure input port
  const inputPorts: PortConfig[] = [];
  for (let i = 0; i < data.inputCount; i++) {
    inputPorts.push({
      index: i,
      type: 'input',
    });
  }

  return (
    <BaseNode inputPorts={inputPorts} selected={selected} className="min-w-[80px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div className="text-xs font-medium text-gray-600">
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
  );
}
