import { test, expect } from "@playwright/test";

const TEST_PAGE = "/test-page.html";

test.describe("<circuit-editor> web component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE);
    await page.waitForFunction(() => customElements.get("circuit-editor") !== undefined);
  });

  test("registers custom element", async ({ page }) => {
    const defined = await page.evaluate(() => customElements.get("circuit-editor") !== undefined);
    expect(defined).toBe(true);
  });

  test("renders with initial circuit source in code panel", async ({ page }) => {
    const editor = page.locator("#test-editor circuit-editor");
    // Should have a textarea with the initial circuit source
    const textarea = editor.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const content = await textarea.inputValue();
    expect(content).toContain("circuit Simple");
    expect(content).toContain("Switch");
  });

  test("renders circuit preview", async ({ page }) => {
    const editor = page.locator("#test-editor circuit-editor");
    // Should render circuit nodes in the preview panel
    await expect(editor.locator(".react-flow__node").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Run button updates circuit after code change", async ({ page }) => {
    const editor = page.locator("#test-editor circuit-editor");
    const textarea = editor.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // Clear and type new circuit source
    await textarea.fill(`circuit TwoLeds {
  impl {
    node A: Switch
    node B: Switch
    node led1: Led
    node led2: Led
    connect A.out -> led1.in
    connect B.out -> led2.in
  }
}`);

    // Click Run
    const runButton = editor.locator("button", { hasText: "Run" });
    await runButton.click();

    // Wait for re-render — should now have 4 nodes
    await page.waitForTimeout(2000);
    const nodeCount = await editor.locator(".react-flow__node").count();
    expect(nodeCount).toBe(4);
  });
});
