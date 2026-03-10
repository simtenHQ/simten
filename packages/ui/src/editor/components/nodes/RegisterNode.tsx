/**
 * RegisterNode Component
 *
 * Renders Register components with support for setting initial value.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface RegisterNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RegisterNode({ data, selected }: RegisterNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Get initial value from node arguments
  const currentNode = useCircuitStore((state) => state.getNode(data.nodeId));
  const initialValue = typeof currentNode?.arguments.initial === 'number'
    ? currentNode.arguments.initial
    : 0;

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

  const handleInitialClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(initialValue.toString());
    setIsEditingInitial(true);
  }, [initialValue]);

  const handleInitialChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleInitialKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
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

      // Validate
      if (isNaN(parsedValue)) {
        parsedValue = 0;
      }

      // Update the node's arguments.initial
      const currentNode = useCircuitStore.getState().getNode(data.nodeId);
      if (currentNode) {
        updateNode(data.nodeId, {
          arguments: { ...currentNode.arguments, initial: parsedValue },
        });
      }
      setIsEditingInitial(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingInitial(false);
    }
  }, [editValue, data.nodeId, updateNode]);

  const handleInitialBlur = useCallback(() => {
    setIsEditingInitial(false);
  }, []);

  // Configure input ports using port names
  const inputPorts: PortConfig[] = data.inputNames.map((name, index) => ({
    name,
    index,
    type: 'input',
  }));

  // Configure output ports using port names
  const outputPorts: PortConfig[] = data.outputNames.map((name, index) => ({
    name,
    index,
    type: 'output',
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
      <BaseNode inputPorts={inputPorts} outputPorts={outputPorts} selected={selected} className="min-w-[100px]">
        <div className="flex flex-col items-center gap-2">
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'Register'}
          </div>

          {/* Register Symbol */}
          <div className="h-auto w-auto px-3 py-2 text-xs font-semibold rounded-md bg-gray-100 dark:bg-[#2a2a2e] text-gray-700 dark:text-gray-300">
            REG
          </div>

          {/* Initial Value Display/Editor */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500 dark:text-gray-400">Initial:</div>
            {isEditingInitial ? (
              <input
                type="text"
                value={editValue}
                onChange={handleInitialChange}
                onKeyDown={handleInitialKeyDown}
                onBlur={handleInitialBlur}
                className="w-20 px-2 py-1 text-center font-mono text-sm border-2 border-blue-500 rounded focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                onClick={handleInitialClick}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-mono text-xs"
                title="Click to edit initial value"
              >
                {initialValue}
              </div>
            )}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
