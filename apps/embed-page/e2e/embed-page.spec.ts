import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { EMBED, HOST, SHARE_ID_FILE, SITE } from './setup';

const id = readFileSync(SHARE_ID_FILE, 'utf8').trim();

/** Opens someone else's page that iframes `src`, collecting console messages. */
async function hostPage(page: Page, src: string): Promise<string[]> {
  const messages: string[] = [];
  page.on('console', (msg) => messages.push(msg.text()));
  page.on('pageerror', (err) => messages.push(`pageerror: ${err.message}`));
  await page.goto(`${HOST}/?src=${encodeURIComponent(src)}`);
  return messages;
}

test('a page on another origin embeds a shared circuit that runs', async ({ page }) => {
  const messages = await hostPage(page, `${EMBED}/s/${id}?theme=dark`);
  const frame = page.frameLocator('#frame');

  const sw = frame.getByRole('switch');
  await expect(sw).toBeVisible({ timeout: 20_000 });
  const led = frame
    .locator('.react-flow__node')
    .filter({ hasNot: frame.getByRole('switch') })
    .filter({ has: frame.getByText(/^(ON|OFF)$/) });
  // sw = 0, so the NOT gate lights the LED; flipping the switch turns it off.
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(led.getByText('ON', { exact: true })).toBeVisible();
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(led.getByText('OFF', { exact: true })).toBeVisible();

  // The wires are drawn: the embed's scoped Preflight once capped every svg,
  // React Flow's edge layer included, at a zero-width parent's width.
  const wires = frame.locator('.react-flow__edges svg').first();
  expect((await wires.boundingBox())?.width).toBeGreaterThan(0);

  const open = frame.getByRole('link', { name: /Open in Simten/ });
  await expect(open).toHaveAttribute('href', `https://simten.dev/circuit/s/${id}`);
  await expect(open).toHaveAttribute('target', '_blank');
  // No Fork button: nothing in the frame creates a share.
  await expect(frame.getByRole('button', { name: /Fork/ })).toHaveCount(0);

  // The enforced CSP blocked nothing the page needs.
  expect(messages.filter((m) => /Content Security Policy|pageerror/.test(m))).toEqual([]);
});

test('the embed page may be framed by anyone and frames only the sandbox', async ({ request }) => {
  const page = await request.get(`${EMBED}/s/${id}`);
  expect(page.status()).toBe(200);
  const csp = page.headers()['content-security-policy'];
  expect(csp).toContain('frame-ancestors *');
  expect(csp).toMatch(/frame-src https:\/\/sandbox\.simtenusercontent\.dev[ ;]/);
  expect(csp).toContain("script-src 'self';");

  const share = await request.get(`${EMBED}/api/share/${id}`);
  expect(share.status()).toBe(200);
  expect(share.headers()['cache-control']).toContain('immutable');
});

test('a share that is not there yet says it is still publishing', async ({ page }) => {
  await hostPage(page, `${EMBED}/s/ffffffffffffffffffff`);
  await expect(page.frameLocator('#frame').getByText(/still publishing/i)).toBeVisible({
    timeout: 10_000,
  });
});

test('a link that can never be a share says not found', async ({ page }) => {
  await hostPage(page, `${EMBED}/s/not-a-share`);
  await expect(page.frameLocator('#frame').getByText('Circuit not found')).toBeVisible();
});

test("simten.dev's pages still refuse to be framed", async ({ page }) => {
  // Reachable on its own...
  await page.goto(SITE);
  await expect(page.getByText('simten.dev stand-in')).toBeVisible();

  // ...but not inside someone else's page.
  const refused = page.waitForEvent('console', (msg) => /frame-ancestors 'self'/.test(msg.text()));
  await hostPage(page, SITE);
  await refused;
  await expect(page.frameLocator('#frame').getByText('simten.dev stand-in')).toHaveCount(0);
});
