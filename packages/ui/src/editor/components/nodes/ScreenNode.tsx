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

  // Extract pixel data (64 pixels for 8x8 grid)
  const pixels = (data.__pixels as number[]) ?? new Array(64).fill(0);

  const GRID_SIZE = 8;
  const PIXEL_SIZE = 16; // SVG units per pixel
  const PIXEL_GAP = 2;   // Gap between pixels

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

          {/* 8x8 Pixel Grid */}
          <svg
            width={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
            height={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
            className="border-2 border-gray-700 rounded bg-black"
            style={{ imageRendering: 'pixelated' }}
          >
            {pixels.map((value, index) => {
              const x = index % GRID_SIZE;
              const y = Math.floor(index / GRID_SIZE);
              const pixelOn = value !== 0;

              return (
                <rect
                  key={index}
                  x={x * (PIXEL_SIZE + PIXEL_GAP)}
                  y={y * (PIXEL_SIZE + PIXEL_GAP)}
                  width={PIXEL_SIZE}
                  height={PIXEL_SIZE}
                  fill={pixelOn ? '#00ff00' : '#1a1a1a'}
                  className="transition-colors duration-100"
                />
              );
            })}
          </svg>

          {/* Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            8×8 pixels
          </div>
        </div>
      </BaseNode>
    </>
  );
}
