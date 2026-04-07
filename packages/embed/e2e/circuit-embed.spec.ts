import { test, expect } from "@playwright/test";

const TEST_PAGE = "/test-page.html";

test.describe("<circuit-embed> web component", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
    });
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await page.goto(TEST_PAGE, { waitUntil: "networkidle" });
  });

  test("registers custom element", async ({ page }) => {
    const defined = await page.evaluate(() => customElements.get("circuit-embed") !== undefined);
    expect(defined).toBe(true);
  });

  test("renders circuit nodes from source", async ({ page }) => {
    const basicSection = page.locator("#test-basic circuit-embed");
    // Wait for the circuit to compile and render — look for ReactFlow nodes
    await expect(basicSection.locator(".react-flow__node").first()).toBeVisible({ timeout: 10_000 });

    // Should have at least 3 nodes (2 switches + 1 gate + 1 LED)
    const nodeCount = await basicSection.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  test("displays title when provided", async ({ page }) => {
    const basicSection = page.locator("#test-basic circuit-embed");
    await expect(basicSection.locator("text=Half Adder Test")).toBeVisible({ timeout: 10_000 });
  });

  test("shows error display for invalid source", async ({ page }) => {
    const errorSection = page.locator("#test-error circuit-embed");
    // Should show error UI, not crash
    await expect(errorSection.locator("[role='alert']")).toBeVisible({ timeout: 10_000 });
  });

  test("multiple instances don't crash", async ({ page }) => {
    // All three circuit-embed elements should render without errors
    const embeds = page.locator("circuit-embed");
    const count = await embeds.count();
    expect(count).toBe(3);

    // Wait for at least the first and third to render nodes
    await expect(page.locator("#test-basic .react-flow__node").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#test-isolation .react-flow__node").first()).toBeVisible({ timeout: 10_000 });

    // No console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("dynamic source update re-renders circuit", async ({ page }) => {
    const basicEmbed = page.locator("#test-basic circuit-embed");
    await expect(basicEmbed.locator(".react-flow__node").first()).toBeVisible({ timeout: 10_000 });

    // Change the source attribute
    await page.evaluate(() => {
      const el = document.querySelector("#test-basic circuit-embed")!;
      el.setAttribute("source", `circuit Simple {
        impl {
          node A: Switch
          node light: Led
          connect A.out -> light.in
        }
      }`);
    });

    // Wait for re-render — node count should change (was 4, now 2)
    await page.waitForTimeout(2000);
    const nodeCount = await basicEmbed.locator(".react-flow__node").count();
    expect(nodeCount).toBe(2);
  });
});
