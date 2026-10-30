import { pixelsOf, usePeripheral, usePortValue } from '../canvas/values';
import { BaseNode } from './BaseNode';
import type { NodeData } from './NodeData';

interface ScreenNodeProps {
  data: NodeData;
  selected?: boolean;
}

/** The memory a Screen shows, following its multiplexer's select line if it has one. */
function useMemoryShown({ pixelSource: source }: NodeData): string | undefined {
  const select = usePortValue(source && 'select' in source ? source.select : undefined);
  if (!source) return undefined;
  if ('memory' in source) return source.memory;
  return source.memories[select === 0 ? 0 : 1];
}

export function ScreenNode({ data, selected }: ScreenNodeProps) {
  const GRID_W = (data.arguments?.width as number) ?? 8;
  const GRID_H = (data.arguments?.height as number) ?? 8;
  const TOTAL_PIXELS = GRID_W * GRID_H;
  const pixels = pixelsOf(usePeripheral(useMemoryShown(data)), TOTAL_PIXELS);
  const PIXEL_SIZE = GRID_W <= 8 ? 16 : GRID_W <= 16 ? 8 : 4;
  const PIXEL_GAP = GRID_W <= 8 ? 2 : GRID_W <= 16 ? 1 : 0;

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
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'Screen'}
        </div>
        <svg
          width={GRID_W * PIXEL_SIZE + (GRID_W - 1) * PIXEL_GAP}
          height={GRID_H * PIXEL_SIZE + (GRID_H - 1) * PIXEL_GAP}
          className="border-2 border-gray-700 rounded bg-black"
          style={{ imageRendering: 'pixelated' }}
        >
          {pixels.slice(0, TOTAL_PIXELS).map((value, index) => {
            const x = index % GRID_W;
            const y = Math.floor(index / GRID_W);
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
        <div className="text-xs text-[var(--embed-text-secondary)]">
          {GRID_W}&times;{GRID_H} pixels
        </div>
      </div>
    </BaseNode>
  );
}
