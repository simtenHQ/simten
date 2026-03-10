/**
 * RAMNode Component
 *
 * Renders RAM components with support for setting initial memory values.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode, PortConfig } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface RAMNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RAMNode({ data, selected }: RAMNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });
  const [isEditingInit, setIsEditingInit] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Get init value from node arguments
  const currentNode = useCircuitStore((state) => state.getNode(data.nodeId));
  const initData = currentNode?.arguments.init;

  // Format init data for display
  const getInitDisplay = () => {
    if (!initData) return 'empty';
    if (Array.isArray(initData)) {
      return `[${initData.length} values]`;
    }
    if (typeof initData === 'object') {
      const entries = Object.keys(initData).length;
      return `{${entries} entries}`;
    }
    return 'empty';
  };

  // Format init data for editing
  const getInitEditValue = () => {
    if (!initData) return '';
    if (Array.isArray(initData)) {
      return JSON.stringify(initData);
    }
    if (typeof initData === 'object') {
      return JSON.stringify(initData);
    }
    return '';
  };

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

  const handleInitClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(getInitEditValue());
    setIsEditingInit(true);
  }, [initData]);

  const handleInitChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleInitKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();

      let parsedValue: any;
      const trimmedValue = editValue.trim();

      if (!trimmedValue) {
        parsedValue = undefined;
      } else {
        try {
          parsedValue = JSON.parse(trimmedValue);
        } catch (error) {
          console.error('Invalid JSON:', error);
          alert('Invalid JSON format. Use:\n- Array: [10, 20, 30]\n- Object: {"64": 3, "65": 4}');
          return;
        }
      }

      // Update the node's arguments.init
      const currentNode = useCircuitStore.getState().getNode(data.nodeId);
      if (currentNode) {
        const newArgs = { ...currentNode.arguments };
        if (parsedValue === undefined) {
          delete newArgs.init;
        } else {
          newArgs.init = parsedValue;
        }
        updateNode(data.nodeId, {
          arguments: newArgs,
        });
      }
      setIsEditingInit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingInit(false);
    }
  }, [editValue, data.nodeId, updateNode]);

  const handleInitBlur = useCallback(() => {
    setIsEditingInit(false);
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
            {data.label || 'RAM'}
          </div>

          {/* RAM Symbol */}
          <div className="h-auto w-auto px-3 py-2 text-xs font-semibold rounded-md bg-gray-100 dark:bg-[#2a2a2e] text-gray-700 dark:text-gray-300">
            RAM
          </div>

          {/* Init Data Display/Editor */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500 dark:text-gray-400">Init:</div>
            {isEditingInit ? (
              <div className="flex flex-col items-center gap-1">
                <textarea
                  value={editValue}
                  onChange={handleInitChange}
                  onKeyDown={handleInitKeyDown}
                  onBlur={handleInitBlur}
                  className="w-40 h-20 px-2 py-1 text-left font-mono text-xs border-2 border-blue-500 rounded focus:outline-none resize-none"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  placeholder='[10,20] or {"64":3}'
                />
                <div className="text-xs text-gray-400">Ctrl+Enter to save</div>
              </div>
            ) : (
              <div
                onClick={handleInitClick}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all font-mono text-xs"
                title="Click to edit init data (JSON format)"
              >
                {getInitDisplay()}
              </div>
            )}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
