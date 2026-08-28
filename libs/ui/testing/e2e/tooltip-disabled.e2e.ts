import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/testing/fixtures/popover-focus.html?case=tooltip-disabled");
});

test("the disabled button's wrapper is the only Tab stop and carries its accessible name", async ({
  page,
}) => {
  const before = page.getByRole("button", { name: "Before disabled tooltip" });
  const disabledButton = page.getByRole("button", { name: "Retry review" });
  const wrapper = disabledButton.locator("..");

  await expect(disabledButton).toBeDisabled();
  await expect(wrapper).toHaveAttribute("tabindex", "0");
  await expect(wrapper).toHaveAccessibleName("Retry review");

  await page.keyboard.press("Tab");
  await expect(before).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(wrapper).toBeFocused();
  await expect(disabledButton).not.toBeFocused();
});

test("the tooltip describes the disabled button in the Chromium accessibility tree", async ({
  page,
}) => {
  const wrapper = page.getByRole("button", { name: "Retry review" }).locator("..");
  await wrapper.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Unavailable while the review is running");

  const session = await page.context().newCDPSession(page);
  try {
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "#disabled-tooltip-button",
    });
    const { nodes } = await session.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    });
    const buttonNode = nodes.find((node) => node.role?.value === "button");
    expect(buttonNode?.description?.value).toBe("Unavailable while the review is running");
  } finally {
    await session.detach();
  }
});

test("keyboard focus shows the tooltip, Tab away hides it, and Escape dismisses it without losing focus", async ({
  page,
}) => {
  const wrapper = page.getByRole("button", { name: "Retry review" }).locator("..");
  const after = page.getByRole("button", { name: "After disabled tooltip" });
  const tooltip = page.getByRole("tooltip");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(wrapper).toBeFocused();
  await expect(tooltip).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await expect(tooltip).toBeHidden();

  await page.keyboard.press("Shift+Tab");
  await expect(wrapper).toBeFocused();
  await expect(tooltip).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(wrapper).toBeFocused();
});

test("hovering the wrapper shows the tooltip and hovering elsewhere hides it", async ({ page }) => {
  const wrapper = page.getByRole("button", { name: "Retry review" }).locator("..");
  const tooltip = page.getByRole("tooltip");

  await wrapper.hover();
  await expect(tooltip).toBeVisible();

  await page.getByRole("button", { name: "Before disabled tooltip" }).hover();
  await expect(tooltip).toBeHidden();
});

test("a touch pointerdown toggles the tooltip without enabling the button", async ({ page }) => {
  const disabledButton = page.getByRole("button", { name: "Retry review" });
  const wrapper = disabledButton.locator("..");
  const tooltip = page.getByRole("tooltip");

  await wrapper.dispatchEvent("pointerdown", { pointerType: "touch" });
  await expect(tooltip).toBeVisible();

  await wrapper.dispatchEvent("pointerdown", { pointerType: "touch" });
  await expect(tooltip).toBeHidden();
  await expect(disabledButton).toBeDisabled();
});
