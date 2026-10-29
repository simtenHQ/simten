import { BaseNode } from './BaseNode';
import type { NodeData } from './NodeData';

interface RasterDisplayNodeProps {
  data: NodeData;
  selected?: boolean;
}

export function RasterDisplayNode({ data, selected }: RasterDisplayNodeProps) {
  const pixels = (data.__pixels as number[]) ?? new Array(64).fill(0);
  const GRID_SIZE = 8;
  const PIXEL_SIZE = 16;
  const PIXEL_GAP = 2;

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: 'output' as const,
      }))}
      className="min-w-[160px]"
      showPortLabels={data.showPortLabels}
      onPortClick={data.onPortClick}
      glowUnconnected={data.glowUnconnected}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'RasterDisplay'}
        </div>
        <svg
          width={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
          height={GRID_SIZE * PIXEL_SIZE + (GRID_SIZE - 1) * PIXEL_GAP}
          className="border-2 border-gray-700 rounded bg-black"
          style={{ imageRendering: 'pixelated' }}
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
                fill={value !== 0 ? '#00ff00' : '#1a1a1a'}
              />
            );
          })}
        </svg>
        <div className="text-xs text-[var(--embed-text-secondary)]">8&times;8 raster scan</div>
      </div>
    </BaseNode>
  );
}
