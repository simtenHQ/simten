// @vitest-environment jsdom

/**
 * A PaletteDisplay on the canvas: the session's frame painted onto a <canvas>
 * through the palette, once per change of frame.
 */

import { bit, bus, circuit, reg } from '@simten/core';
import { PALETTE_2C02, PaletteDisplay } from '@simten/core/std';
import type { SandboxClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CircuitCanvas } from '../../canvas/CircuitCanvas';
import { SandboxProvider } from '../../sandbox/SandboxProvider';
import { type UseSimulationResult, useSimulation } from '../../sandbox/useSimulation';
import { paintFrame, pixelScale } from '../PaletteDisplayNode';

/** Writes colour i + 1 to pixel i of a 4x2 screen, one per clock, for one frame. */
const Fill = circuit('PaletteFill', {
  outputs: { x: bus(2), y: bus(1), color: bus(6), we: bit },
  state: { at: reg(4) },
  eval: ({ at }) => ({ x: at & 3, y: (at >> 2) & 1, color: at + 1, we: at < 8 ? 1 : 0 }),
  onTick: ({ at }) => ({ at: at < 8 ? at + 1 : 8 }),
});

const Screen4x2 = circuit('PaletteScreen4x2', {
  nodes: {
    fill: Fill,
    tv: PaletteDisplay({ width: 4, height: 2, palette: [0, 0xff0000, 0x00ff00, 0x0000ff] }),
  },
  connect: ({ nodes: { fill, tv } }) => [
    fill.x.to(tv.x),
    fill.y.to(tv.y),
    fill.color.to(tv.color),
    fill.we.to(tv.we),
  ],
});

/** What the fake 2D context was asked to draw: each putImageData's bytes. */
const painted: Uint8ClampedArray[] = [];

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
  } as unknown as typeof DOMMatrixReadOnly;
  // jsdom has no 2D canvas: record what would be drawn instead.
  const context = {
    createImageData: (width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: (image: ImageData) => painted.push(image.data.slice()),
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as HTMLCanvasElement['getContext'];
});

const clients: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  painted.length = 0;
  for (const c of clients.splice(0)) c.dispose();
});

/** The RGB of each pixel in a painted frame. */
const colours = (rgba: Uint8ClampedArray) =>
  Array.from(
    { length: rgba.length / 4 },
    (_, i) => (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2],
  );

describe('PaletteDisplayNode', () => {
  it('paints the frame through the palette, and again only when the frame changes', async () => {
    let sim: UseSimulationResult | null = null;
    function Demo() {
      sim = useSimulation(Screen4x2);
      return <CircuitCanvas simulation={sim} height={300} />;
    }
    const client = inProcessSandbox();
    clients.push(client);
    render(
      <SandboxProvider client={client}>
        <Demo />
      </SandboxProvider>,
    );
    const canvas = await waitFor(() => {
      const found = document.querySelector('canvas[aria-label="4×2 screen"]');
      if (!found) throw new Error('no screen yet');
      return found as HTMLCanvasElement;
    });
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    expect(canvas.style.imageRendering).toBe('pixelated');
    await waitFor(() => expect(painted.length).toBeGreaterThan(0));
    expect(colours(painted[painted.length - 1])).toEqual(new Array(8).fill(0));

    await act(async () => sim?.actions.tick(8));
    await waitFor(() =>
      expect(colours(painted[painted.length - 1])).toEqual([
        0xff0000, 0x00ff00, 0x0000ff, 0, 0, 0, 0, 0,
      ]),
    );

    // The frame is done; more clocks change the counter but not the picture.
    const paints = painted.length;
    await act(async () => sim?.actions.tick(3));
    await waitFor(() => expect(sim?.state.cycle).toBe(11));
    expect(painted.length).toBe(paints);
  });
});

describe('paintFrame', () => {
  it('colours each pixel from the palette, black past its end', () => {
    const rgba = new Uint8ClampedArray(3 * 4);
    paintFrame(rgba, '\x00\x30\x3f', 3, 1, PALETTE_2C02.slice(0, 0x31));
    expect(colours(rgba)).toEqual([PALETTE_2C02[0], PALETTE_2C02[0x30], 0]);
    expect(rgba[3]).toBe(0xff);
  });
});

describe('pixelScale', () => {
  it('draws a 256x240 screen at 2x and keeps small screens readable', () => {
    expect(pixelScale(256, 240)).toBe(2);
    expect(pixelScale(8, 8)).toBe(16);
    expect(pixelScale(1024, 768)).toBe(1);
  });
});
