/**
 * InputNode Component (IR v0.1)
 *
 * Renders input components:
 * - Switch: toggle switch (boolean on/off)
 * - Input: numeric input with value display and +/- buttons
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

interface InputNodeProps {
  data: NodeData;
  selected?: boolean;
}

/**
 * Numeric input control for multi-bit Input components.
 * Shows hex value with +/- buttons and direct text entry.
 */
function NumericInputControl({ data }: { data: NodeData }) {
  const width = data.width ?? 8;
  const maxValue = (1 << width) - 1;
  const currentValue = data.numericValue ?? 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const setValue = useCallback((newValue: number) => {
    const clamped = Math.max(0, Math.min(maxValue, newValue));
    if (data.onValueChange) {
      data.onValueChange(clamped);
    }
  }, [data, maxValue]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(currentValue.toString());
    setIsEditing(true);
  }, [currentValue]);

  const handleFinishEdit = useCallback(() => {
    const parsed = parseInt(editText, 10);
    if (!isNaN(parsed)) {
      setValue(parsed);
    }
    setIsEditing(false);
  }, [editText, setValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [handleFinishEdit]);

  const hexDigits = Math.ceil(width / 4);
  const hexValue = currentValue.toString(16).toUpperCase().padStart(hexDigits, '0');

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Value display */}
      <div className="flex items-center gap-1">
        {/* Decrement */}
        <button
          onClick={(e) => { e.stopPropagation(); setValue(currentValue - 1); }}
          className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-bold active:scale-90 transition-all"
        >
          -
        </button>

        {/* Hex display / edit */}
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-14 h-7 text-center text-xs font-mono bg-white border border-blue-400 rounded outline-none text-gray-800"
          />
        ) : (
          <button
            onClick={handleStartEdit}
            className="w-14 h-7 flex items-center justify-center rounded bg-gray-800 text-emerald-400 font-mono text-sm font-bold hover:bg-gray-700 transition-colors cursor-text"
            title="Click to type a value"
          >
            0x{hexValue}
          </button>
        )}

        {/* Increment */}
        <button
          onClick={(e) => { e.stopPropagation(); setValue(currentValue + 1); }}
          className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-bold active:scale-90 transition-all"
        >
          +
        </button>
      </div>

      {/* Decimal display */}
      <div className="text-[10px] text-gray-500 font-mono">
        = {currentValue}
      </div>
    </div>
  );
}

export function InputNode({ data, selected }: InputNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const value = data.value ?? false;
  const isNumericInput = data.componentRef === 'Input';
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
    type: 'output' as const,
    value: isNumericInput ? (data.numericValue ?? 0) !== 0 : value,
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
      <BaseNode outputPorts={outputPorts} selected={selected} className="min-w-[80px]" showPortLabels={data.showPortLabels} onPortClick={data.onPortClick} glowUnconnected={data.glowUnconnected}>
        <div className="relative flex flex-col items-center gap-2">
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

          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || data.componentRef}
          </div>

          {isNumericInput ? (
            <NumericInputControl data={data} />
          ) : (
            <>
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
            </>
          )}
        </div>
      </BaseNode>
    </>
  );
}
