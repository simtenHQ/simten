/**
 * ScreenNode Component (IR v0.1)
 *
 * Renders a memory-mapped 8x8 pixel display.
 * Simulates real display controllers (VIC-II, PPU, GPU) that read video RAM via DMA.
 *
 * The Screen component reads RAM addresses 0-63 directly from sequential state,
 * displaying each byte as a pixel (0 = off/black, non-zero = on/green).
 */

'use client';

import React, { useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useCircuitStore } from '../../stores/circuit-store';
import type { NodeData } from '../../utils/projection';
import { LabelEditor } from '../LabelEditor';

interface ScreenNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function ScreenNode({ data, selected }: ScreenNodeProps) {
  const updateNode = useCircuitStore((state) => state.updateNode);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelPosition, setLabelPosition] = useState({ x: 0, y: 0 });

  // Read dimensions from node arguments (default 8x8)
  const GRID_W = (data.arguments?.width as number) ?? 8;
  const GRID_H = (data.arguments?.height as number) ?? 8;
  const TOTAL_PIXELS = GRID_W * GRID_H;

  // Extract pixel data
  const pixels = (data.__pixels as number[]) ?? new Array(TOTAL_PIXELS).fill(0);

  // Scale pixel size down for larger displays so the node doesn't get huge
  const PIXEL_SIZE = GRID_W <= 8 ? 16 : GRID_W <= 16 ? 8 : 4;
  const PIXEL_GAP = GRID_W <= 8 ? 2 : GRID_W <= 16 ? 1 : 0;

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
          {/* Component Label */}
          <div
            className="px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit label"
          >
            {data.label || 'Screen'}
          </div>

          {/* Pixel Grid */}
          <svg
            width={GRID_W * PIXEL_SIZE + (GRID_W - 1) * PIXEL_GAP}
            height={GRID_H * PIXEL_SIZE + (GRID_H - 1) * PIXEL_GAP}
            className="border-2 border-gray-700 rounded bg-black"
            style={{ imageRendering: 'pixelated' }}
          >
            {pixels.slice(0, TOTAL_PIXELS).map((value, index) => {
              const x = index % GRID_W;
              const y = Math.floor(index / GRID_W);
              const pixelOn = value !== 0;

              return (
                <rect
                  key={index}
                  x={x * (PIXEL_SIZE + PIXEL_GAP)}
                  y={y * (PIXEL_SIZE + PIXEL_GAP)}
                  width={PIXEL_SIZE}
                  height={PIXEL_SIZE}
                  fill={pixelOn ? '#00ff00' : '#1a1a1a'}
                />
              );
            })}
          </svg>

          {/* Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {GRID_W}×{GRID_H} pixels
          </div>
        </div>
      </BaseNode>
    </>
  );
}
