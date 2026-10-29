import { expect, test } from '@playwright/test';

test.describe('<CircuitEmbed>', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    });
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('renders circuit nodes', async ({ page }) => {
    const basic = page.locator('#test-basic');
    await expect(basic.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    // Two switches, the half adder and two lamps.
    const nodeCount = await basic.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  test('displays title when provided', async ({ page }) => {
    await expect(page.locator('#test-basic').getByText('Half Adder Test')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('the circuit simulates: flipping the switch flips the lamp', async ({ page }) => {
    const toggle = page.locator('#test-isolation');
    const sw = toggle.getByRole('switch');
    await expect(sw).toBeVisible({ timeout: 10_000 });
    const led = toggle
      .locator('.react-flow__node')
      // Inner locators are matched inside each node, so they start from the page.
      .filter({ hasNot: page.getByRole('switch') })
      .filter({ has: page.getByText(/^(ON|OFF)$/) });
    // sw = 0, so the NOT gate lights the lamp.
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(led.getByText('ON', { exact: true })).toBeVisible();
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(led.getByText('OFF', { exact: true })).toBeVisible();
  });

  test('source that does not compile shows an error', async ({ page }) => {
    await expect(page.locator("#test-error [role='alert']")).toBeVisible({ timeout: 10_000 });
  });

  test("multiple instances don't crash", async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await expect(page.locator('#test-basic .react-flow__node').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('#test-isolation .react-flow__node').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('a new circuit prop re-renders the canvas', async ({ page }) => {
    const basic = page.locator('#test-basic');
    await expect(basic.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
    const before = await basic.locator('.react-flow__node').count();

    await basic.getByRole('button', { name: 'Swap circuit' }).click();

    // Two nodes now: a switch and a lamp, and no harness because the circuit
    // declares no ports.
    await expect(basic.locator('.react-flow__node')).toHaveCount(2, { timeout: 10_000 });
    expect(before).not.toBe(2);
  });
});
