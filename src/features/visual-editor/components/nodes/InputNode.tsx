/**
 * InputNode Component (IR v0.1)
 *
 * Renders input components like switches.
 * User-controllable components that generate signals.
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
import { cn } from '@/lib/utils';
import { LabelEditor } from '../LabelEditor';

interface InputNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function InputNode({ data, selected }: InputNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const value = data.value ?? false;
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection when clicking the switch

    // Use custom onToggle callback if provided (e.g., from MiniCanvas)
    if (data.onToggle) {
      data.onToggle();
      return;
    }

    // Otherwise update the node's arguments.value via circuit store
    const currentNode = useCircuitStore.getState().getNode(data.nodeId);
    if (currentNode) {
      updateNode(data.nodeId, {
        arguments: { ...currentNode.arguments, value: !value },
      });
    }
  }, [data.nodeId, data.onToggle, value, updateNode]);

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

  // Configure output ports using port names
  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
    value,
  }));

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
      <BaseNode outputPorts={outputPorts} selected={selected} className="min-w-[80px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentRef}
          </div>

          {/* Switch Toggle */}
          <button
            onClick={handleToggle}
            className={cn(
              'group relative h-9 w-16 rounded-full transition-all duration-300 ease-in-out',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'hover:shadow-md active:scale-95',
              value
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-sm shadow-green-200 focus-visible:ring-green-400'
                : 'bg-gradient-to-r from-gray-300 to-gray-400 shadow-sm shadow-gray-200 focus-visible:ring-gray-400'
            )}
          >
            {/* Inner track shadow for depth */}
            <span
              className={cn(
                'absolute inset-0 rounded-full opacity-30 transition-opacity duration-300',
                value ? 'bg-black/10' : 'bg-black/5'
              )}
              style={{
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            />

            {/* Toggle knob */}
            <span
              className={cn(
                'absolute top-0.5 flex items-center justify-center',
                'h-8 w-8 rounded-full bg-white',
                'shadow-lg transition-all duration-300 ease-out',
                'group-hover:shadow-xl',
                value
                  ? 'translate-x-[1.875rem] shadow-green-300/50'
                  : 'translate-x-0.5 shadow-gray-400/30'
              )}
            >
              {/* Inner highlight for glossy effect */}
              <span className="absolute inset-1 rounded-full bg-gradient-to-br from-white to-gray-50" />

              {/* Subtle indicator dot */}
              <span
                className={cn(
                  'relative z-10 h-2 w-2 rounded-full transition-all duration-300',
                  value
                    ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-sm shadow-green-300'
                    : 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-sm shadow-gray-200'
                )}
              />
            </span>
          </button>

          {/* Value Display */}
          <div
            className={cn(
              'text-xs font-semibold tracking-wide transition-colors duration-300',
              value ? 'text-emerald-600' : 'text-gray-500'
            )}
          >
            {value ? 'ON' : 'OFF'}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
