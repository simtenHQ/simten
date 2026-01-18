/**
 * ComponentPalette Component
 *
 * Displays available components that can be dragged onto the canvas.
 */

'use client';

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useIRStore, useMetadataStore } from '../stores';
import type { ComponentType } from '../types';
import { ComponentTooltip, PortInfo } from './ComponentTooltip';

interface PaletteItem {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
  inputs?: PortInfo[];
  outputs?: PortInfo[];
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'SWITCH',
    label: 'Switch',
    description: 'User-controlled input that can be toggled ON or OFF',
    icon: '⚡',
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'LED',
    label: 'LED',
    description: 'Visual indicator that lights up when input signal is ON',
    icon: '💡',
    inputs: [{ index: 0, label: 'Input', value: undefined }],
  },
  {
    type: 'AND_GATE',
    label: 'AND Gate',
    description: 'Output is ON when both inputs are ON',
    icon: '&',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'OR_GATE',
    label: 'OR Gate',
    description: 'Output is ON when at least one input is ON',
    icon: '≥1',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'NOT_GATE',
    label: 'NOT Gate',
    description: 'Output is the inverse of the input',
    icon: '¬',
    inputs: [{ index: 0, label: 'Input', value: undefined }],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'NAND_GATE',
    label: 'NAND Gate',
    description: 'Output is OFF only when both inputs are ON',
    icon: '⊼',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'NOR_GATE',
    label: 'NOR Gate',
    description: 'Output is ON only when both inputs are OFF',
    icon: '⊽',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'XOR_GATE',
    label: 'XOR Gate',
    description: 'Output is ON when inputs are different',
    icon: '⊕',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'XNOR_GATE',
    label: 'XNOR Gate',
    description: 'Output is ON when inputs are the same',
    icon: '⊙',
    inputs: [
      { index: 0, label: 'A', value: undefined },
      { index: 1, label: 'B', value: undefined },
    ],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
  {
    type: 'BUFFER',
    label: 'Buffer',
    description: 'Passes input to output unchanged',
    icon: '▷',
    inputs: [{ index: 0, label: 'Input', value: undefined }],
    outputs: [{ index: 0, label: 'Output', value: undefined }],
  },
];

export function ComponentPalette() {
  const addComponent = useIRStore((state) => state.addComponent);
  const setComponentMetadata = useMetadataStore((state) => state.setComponentMetadata);

  const onDragStart = useCallback((event: React.DragEvent, componentType: ComponentType) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', componentType);
  }, []);

  const handleClick = useCallback(
    (componentType: ComponentType) => {
      // Add component to IR
      const componentId = addComponent(componentType);

      // Add metadata with default position (center of canvas)
      setComponentMetadata(componentId, {
        id: componentId,
        position: { x: 250, y: 250 }, // Default position
      });
    },
    [addComponent, setComponentMetadata]
  );

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Components</h2>
        <p className="text-xs text-gray-500">Drag onto canvas or click to add</p>
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {PALETTE_ITEMS.map((item) => (
            <ComponentTooltip
              key={item.type}
              title={item.label.toUpperCase()}
              description={item.description}
              inputs={item.inputs}
              outputs={item.outputs}
            >
              <div
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                onClick={() => handleClick(item.type)}
                className={cn(
                  'cursor-move rounded-lg border-2 border-gray-300 bg-white p-3 shadow-sm transition-all',
                  'hover:border-blue-400 hover:shadow-md active:scale-95'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-xl">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">
                      {item.inputs ? `${item.inputs.length} input${item.inputs.length > 1 ? 's' : ''}` : ''}
                      {item.inputs && item.outputs ? ', ' : ''}
                      {item.outputs ? `${item.outputs.length} output${item.outputs.length > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </ComponentTooltip>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          <strong>Tip:</strong> Drag components onto the canvas or click to add at default position
        </p>
      </div>
    </div>
  );
}
