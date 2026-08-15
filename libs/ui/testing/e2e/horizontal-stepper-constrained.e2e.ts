import { expect, type Locator, type Page, test } from "@playwright/test";

async function setContainerWidth(
  page: Page,
  width: number,
  testId = "stepper-container",
): Promise<void> {
  await page.getByTestId(testId).evaluate((element, nextWidth) => {
    element.style.maxWidth = `${nextWidth}px`;
    element.style.width = `${nextWidth}px`;
  }, width);
}

async function visibleElisionCount(stepper: Locator): Promise<number> {
  const markers = await stepper.getByText(/^\+\d+$/).all();
  let visible = 0;
  for (const marker of markers) {
    if (await marker.isVisible()) visible += 1;
  }
  return visible;
}

async function stepLabelIsLayoutVisible(stepper: Locator, label: string): Promise<boolean> {
  const item = stepper.locator("[data-status]").filter({ hasText: label });
  return item.evaluate((element, stepLabel) => {
    const target = [...element.children].find(
      (child): child is HTMLSpanElement =>
        child instanceof HTMLSpanElement &&
        child.textContent?.includes(stepLabel) &&
        !child.classList.contains("sr-only"),
    );
    if (!target) return false;
    const style = window.getComputedStyle(target);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") return false;
    const rect = target.getBoundingClientRect();
    return rect.width > 4 && rect.height > 4;
  }, label);
}

async function hasHorizontalOverflow(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
}

test.describe("HorizontalStepper constrained containers", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/testing/fixtures/horizontal-stepper-constrained.html");
    await expect(page.getByRole("list", { name: "Setup progress" })).toBeVisible();
  });

  test("keeps the full run visible in a wide container without horizontal overflow", async ({
    page,
  }) => {
    await setContainerWidth(page, 960);

    const stepper = page.getByRole("list", { name: "Setup progress" });
    const connectors = stepper.locator('[role="presentation"]');
    await expect(connectors.first()).toBeVisible();
    expect(await stepLabelIsLayoutVisible(stepper, "Storage")).toBe(true);
    expect(await stepLabelIsLayoutVisible(stepper, "API Key")).toBe(true);
    expect(await hasHorizontalOverflow(stepper)).toBe(false);
    await expect(stepper.locator('[data-status="active"]')).toHaveAttribute("aria-current", "step");
  });

  test("drops connectors and inactive labels below 380px while keeping the active step visible", async ({
    page,
  }) => {
    await setContainerWidth(page, 380);

    const stepper = page.getByRole("list", { name: "Setup progress" });
    const connectors = stepper.locator('[role="presentation"]');
    await expect(connectors.first()).toBeHidden();
    expect(await stepLabelIsLayoutVisible(stepper, "Storage")).toBe(false);
    expect(await stepLabelIsLayoutVisible(stepper, "API Key")).toBe(true);
    expect(await hasHorizontalOverflow(stepper)).toBe(false);
    await expect(stepper.locator('[data-status="active"]')).toHaveAttribute("aria-current", "step");
    expect(await stepper.locator("[data-status]").count()).toBe(6);
  });

  test("windows the glyph run with elision counters below 280px", async ({ page }) => {
    await setContainerWidth(page, 280);

    const stepper = page.getByRole("list", { name: "Setup progress" });
    await expect(stepper.getByText("+1", { exact: true })).toBeVisible();
    await expect(stepper.getByText("+2", { exact: true })).toBeVisible();
    expect(await stepLabelIsLayoutVisible(stepper, "API Key")).toBe(true);
    expect(await hasHorizontalOverflow(stepper)).toBe(false);
    await expect(stepper.locator('[data-status="active"]')).toHaveAttribute("aria-current", "step");
  });

  test("elides on step count, not on a blanket width: at one width only the long run windows", async ({
    page,
  }) => {
    for (const testId of ["stepper-container", "stepper-container-short", "stepper-container-long"])
      await setContainerWidth(page, 420, testId);

    const six = page.getByRole("list", { name: "Setup progress" });
    const three = page.getByRole("list", { name: "Short run" });
    const twelve = page.getByRole("list", { name: "Long run" });

    expect(await visibleElisionCount(twelve)).toBeGreaterThan(0);
    expect(await visibleElisionCount(six)).toBe(0);
    expect(await visibleElisionCount(three)).toBe(0);
    expect(await stepLabelIsLayoutVisible(twelve, "Phase 6")).toBe(true);
    expect(await hasHorizontalOverflow(twelve)).toBe(false);
  });

  test("never elides a three-step run, at any width", async ({ page }) => {
    const three = page.getByRole("list", { name: "Short run" });

    for (const width of [960, 420, 280, 200]) {
      await setContainerWidth(page, width, "stepper-container-short");
      expect(await visibleElisionCount(three)).toBe(0);
      expect(await stepLabelIsLayoutVisible(three, "Pick")).toBe(true);
      expect(await hasHorizontalOverflow(three)).toBe(false);
    }
  });

  test("keeps only the active step and glyph below 200px", async ({ page }) => {
    await setContainerWidth(page, 200);

    const stepper = page.getByRole("list", { name: "Setup progress" });
    expect(await stepLabelIsLayoutVisible(stepper, "Storage")).toBe(false);
    expect(await stepLabelIsLayoutVisible(stepper, "Provider")).toBe(false);
    expect(await stepLabelIsLayoutVisible(stepper, "API Key")).toBe(true);

    const activeItem = stepper.locator('[data-status="active"]');
    await expect(activeItem).toHaveAttribute("aria-current", "step");
    await expect(activeItem).toContainText("[~]");
    expect(await hasHorizontalOverflow(stepper)).toBe(false);
    expect(await stepper.locator("[data-status]").count()).toBe(6);
  });
});
