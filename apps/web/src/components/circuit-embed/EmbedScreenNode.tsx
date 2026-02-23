"use client";

import React from "react";
import { BaseNode } from "@/features/visual-editor/components/nodes/BaseNode";
import type { NodeData } from "@/features/visual-editor/utils/projection";

interface EmbedScreenNodeProps {
  data: NodeData;
  selected?: boolean;
}

const GRID_SIZE = 8;
const PIXEL_SIZE = 16;
const PIXEL_GAP = 2;

/**
 * Lightweight screen node for embeds - no useCircuitStore dependency.
 * Reads pixel data directly from data.__pixels.
 */
export function EmbedScreenNode({ data, selected }: EmbedScreenNodeProps) {
  const pixels = (data.__pixels as number[]) ?? new Array(64).fill(0);

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({
        name,
        index,
        type: "input" as const,
      }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: "output" as const,
      }))}
      className="min-w-[160px]"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 rounded text-xs font-medium text-gray-700">
          {data.label || "Screen"}
        </div>
        <svg
          width={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
          height={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
          className="border-2 border-gray-700 rounded bg-black"
          style={{ imageRendering: "pixelated" }}
        >
          {pixels.map((value, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            return (
              <rect
                key={index}
                x={x * (PIXEL_SIZE + PIXEL_GAP)}
                y={y * (PIXEL_SIZE + PIXEL_GAP)}
                width={PIXEL_SIZE}
                height={PIXEL_SIZE}
                fill={value !== 0 ? "#00ff00" : "#1a1a1a"}
                className="transition-colors duration-100"
              />
            );
          })}
        </svg>
        <div className="text-xs text-gray-500">8x8 pixels</div>
      </div>
    </BaseNode>
  );
}
