import { paletteFrame } from '@simten/core/internal';
import { PALETTE_2C02 } from '@simten/core/std';
import { useEffect, useRef } from 'react';
import { usePeripheral } from '../canvas/values';
import { BaseNode } from './BaseNode';
import type { NodeData } from './NodeData';

interface PaletteDisplayNodeProps {
  data: NodeData;
  selected?: boolean;
}

/** The longest side the screen is drawn at, in CSS pixels, before zoom. */
const DRAWN_SIZE = 512;

/** How many CSS pixels a screen pixel takes: whole, so pixels stay square and sharp. */
export function pixelScale(width: number, height: number): number {
  return Math.min(16, Math.max(1, Math.floor(DRAWN_SIZE / Math.max(width, height))));
}

/**
 * Fill `rgba` (an ImageData's bytes) with the frame `pixels` holds, each pixel
 * its colour from `palette`. An index past the palette's end is black.
 */
export function paintFrame(
  rgba: Uint8ClampedArray,
  pixels: string,
  width: number,
  height: number,
  palette: readonly number[],
): void {
  const frame = paletteFrame(pixels, width, height);
  for (let i = 0; i < frame.length; i++) {
    const rgb = palette[frame[i]] ?? 0;
    const at = i * 4;
    rgba[at] = (rgb >> 16) & 0xff;
    rgba[at + 1] = (rgb >> 8) & 0xff;
    rgba[at + 2] = rgb & 0xff;
    rgba[at + 3] = 0xff;
  }
}

function isPalette(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((c) => typeof c === 'number');
}

/**
 * A `PaletteDisplay`: its framebuffer drawn onto one <canvas> through its
 * palette. The session sends the frame as a string, one char per pixel; the
 * canvas is repainted only when that string changes.
 */
export function PaletteDisplayNode({ data, selected }: PaletteDisplayNodeProps) {
  const width = typeof data.arguments?.width === 'number' ? data.arguments.width : 256;
  const height = typeof data.arguments?.height === 'number' ? data.arguments.height : 240;
  const palette = isPalette(data.arguments?.palette) ? data.arguments.palette : PALETTE_2C02;
  const state = usePeripheral(data.path);
  const pixels = typeof state === 'string' ? state : '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<ImageData | null>(null);
  const scale = pixelScale(width, height);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    let image = imageRef.current;
    if (!image || image.width !== width || image.height !== height) {
      image = context.createImageData(width, height);
      imageRef.current = image;
    }
    paintFrame(image.data, pixels, width, height, palette);
    context.putImageData(image, 0, 0);
  }, [pixels, width, height, palette]);

  return (
    <BaseNode
      selected={selected}
      inputPorts={data.inputNames.map((name, index) => ({ name, index, type: 'input' as const }))}
      outputPorts={data.outputNames.map((name, index) => ({
        name,
        index,
        type: 'output' as const,
      }))}
      showPortLabels={data.showPortLabels}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="px-2 py-1 text-xs font-medium text-[var(--embed-text-primary)]">
          {data.label || 'PaletteDisplay'}
        </div>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          aria-label={`${width}×${height} screen`}
          className="border-2 border-gray-700 rounded bg-black"
          style={{ width: width * scale, height: height * scale, imageRendering: 'pixelated' }}
        />
        <div className="text-xs text-[var(--embed-text-secondary)]">
          {width}&times;{height} pixels
        </div>
      </div>
    </BaseNode>
  );
}
