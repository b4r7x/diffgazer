import { expect, test } from "@playwright/test";

test("disabled tooltip exposes one named Tab stop and describes its disabled button in Chromium AX", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=tooltip-disabled");
  const before = page.getByRole("button", { name: "Before disabled tooltip" });
  const disabledButton = page.getByRole("button", { name: "Retry review" });
  const wrapper = disabledButton.locator("..");
  const after = page.getByRole("button", { name: "After disabled tooltip" });

  await expect(disabledButton).toBeDisabled();
  await expect(wrapper).toHaveJSProperty("tagName", "SPAN");
  await expect(wrapper).toHaveAttribute("tabindex", "0");
  await expect(wrapper).toHaveAccessibleName("Retry review");

  await page.keyboard.press("Tab");
  await expect(before).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(wrapper).toBeFocused();
  await expect(disabledButton).not.toBeFocused();

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Unavailable while the review is running");

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

  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await expect(tooltip).toBeHidden();

  await page.keyboard.press("Shift+Tab");
  await expect(wrapper).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(wrapper).toBeFocused();

  await after.focus();

  await wrapper.hover();
  await expect(tooltip).toBeVisible();
  await page.getByRole("button", { name: "Before disabled tooltip" }).hover();
  await expect(tooltip).toBeHidden();

  await wrapper.dispatchEvent("pointerdown", { pointerType: "touch" });
  await expect(tooltip).toBeVisible();
  await wrapper.dispatchEvent("pointerdown", { pointerType: "touch" });
  await expect(tooltip).toBeHidden();
  await expect(disabledButton).toBeDisabled();
});
