import { expect, test } from '@playwright/test';
import { PALETTE_2C02 } from '@simten/core/std';

test('a PaletteDisplay draws a 256x240 frame of colour bars from the sandbox', async ({ page }) => {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  const section = page.locator('#test-palette');
  const screen = section.locator('canvas[aria-label="256×240 screen"]');
  await expect(screen).toBeAttached({ timeout: 10_000 });
  await expect(screen).toHaveCSS('image-rendering', 'pixelated');

  await section.getByRole('button', { name: 'Draw frame' }).click();
  await expect(section.getByText('cycle 61440')).toBeVisible({ timeout: 20_000 });

  // Each sampled pixel, as 0xRRGGBB, read back from the canvas.
  const points = [
    [0, 0],
    [7, 10],
    [128, 120],
    [200, 239],
    [255, 239],
  ];
  const expected = points.map(([x]) => PALETTE_2C02[x >> 2]);
  await expect
    .poll(() =>
      screen.evaluate((canvas: HTMLCanvasElement, at) => {
        const context = canvas.getContext('2d');
        if (!context) return [];
        return at.map(([x, y]) => {
          const [r, g, b] = context.getImageData(x, y, 1, 1).data;
          return (r << 16) | (g << 8) | b;
        });
      }, points),
    )
    .toEqual(expected);
});
