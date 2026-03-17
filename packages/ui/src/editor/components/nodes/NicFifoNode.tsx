/**
 * NicFifoNode Component
 *
 * Renders a network interface controller with TX/RX FIFO status.
 * Shows FIFO fill levels and network activity indicators.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface NicFifoNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function NicFifoNode({ data, selected }: NicFifoNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });

  const nicState = data.__nicState as { txCount: number; rxCount: number; draining: boolean } | undefined;
  const txCount = nicState?.txCount ?? 0;
  const rxCount = nicState?.rxCount ?? 0;
  const draining = nicState?.draining ?? false;

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
      <BaseNode
        selected={selected}
        inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
        outputPorts={data.outputNames.map((name, index) => ({ name, index, type: 'output' as const }))}
        className="min-w-[160px]"
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'NIC'}
          </div>

          <div className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">TX FIFO:</span>
              <span className="text-blue-600 dark:text-blue-400">{txCount} words</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">RX FIFO:</span>
              <span className="text-green-600 dark:text-green-400">{rxCount} words</span>
            </div>
            {draining && (
              <div className="text-center text-yellow-600 dark:text-yellow-400 font-bold">
                TRANSMITTING
              </div>
            )}
          </div>
        </div>
      </BaseNode>
    </>
  );
}
