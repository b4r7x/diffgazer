import { expect, type Locator, type Page, test } from "@playwright/test";

type ActivationMode = "keyboard" | "pointer" | "programmatic";

async function activatePopover(page: Page, trigger: Locator, activation: ActivationMode) {
  if (activation === "pointer") {
    await trigger.click();
  } else if (activation === "keyboard") {
    await trigger.focus();
    await page.keyboard.press("Enter");
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test("native Tab advances between content controls without dismissing", async ({ page }) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=native-tab");
  const trigger = page.getByRole("button", { name: "Native tab trigger" });
  const first = page.getByRole("button", { name: "First action" });
  const second = page.getByRole("button", { name: "Second action" });

  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");

  await expect(second).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

for (const mode of ["controlled", "uncontrolled"] as const) {
  for (const activation of ["keyboard", "pointer", "programmatic"] as const) {
    test(`${mode} ${activation} popover preserves its focus pair and closes once on focus exit`, async ({
      page,
    }) => {
      const fixtureUrl = `/tests/fixtures/popover-focus.html?case=${mode}&activation=${activation}`;
      await page.goto(fixtureUrl);
      const trigger = page.getByRole("button", { name: "Boundary trigger" });
      const contentAction = page.getByRole("button", { name: "Boundary action" });
      const outside = page.getByRole("button", { name: "Outside" });
      const closeRequests = page.getByRole("status", { name: "Close requests" });

      await activatePopover(page, trigger, activation);
      await trigger.focus();
      await contentAction.focus();
      await trigger.focus();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(closeRequests).toHaveText("0");

      await outside.focus();

      await expect(outside).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(closeRequests).toHaveText("1");

      await page.goto(fixtureUrl);
      await activatePopover(page, trigger, activation);
      await contentAction.focus();
      await outside.focus();

      await expect(outside).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(closeRequests).toHaveText("1");
    });
  }

  test(`${mode} popover closes once when pointer focus moves outside`, async ({ page }) => {
    await page.goto(`/tests/fixtures/popover-focus.html?case=${mode}`);
    const trigger = page.getByRole("button", { name: "Boundary trigger" });
    const contentAction = page.getByRole("button", { name: "Boundary action" });
    const outside = page.getByRole("button", { name: "Outside" });
    const closeRequests = page.getByRole("status", { name: "Close requests" });

    await contentAction.focus();
    await outside.click();

    await expect(outside).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(closeRequests).toHaveText("1");
  });

  test(`${mode} popover closes once when Tab moves focus outside`, async ({ page }) => {
    await page.goto(`/tests/fixtures/popover-focus.html?case=${mode}`);
    const trigger = page.getByRole("button", { name: "Boundary trigger" });
    const outside = page.getByRole("button", { name: "Outside" });
    const closeRequests = page.getByRole("status", { name: "Close requests" });

    await trigger.focus();
    await page.keyboard.press("Tab");

    await expect(outside).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(closeRequests).toHaveText("1");
  });
}

test("one outside pointer gesture produces one controlled refusal and a later gesture retries", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=refuse-close");
  const trigger = page.getByRole("button", { name: "Boundary trigger" });
  const outside = page.getByRole("button", { name: "Outside" });
  const closeRequests = page.getByRole("status", { name: "Close requests" });

  await trigger.focus();
  await outside.click();
  await expect(closeRequests).toHaveText("1");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await trigger.focus();
  await outside.click();

  await expect(closeRequests).toHaveText("2");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("focus can enter a nested portaled popover identified by aria-controls", async ({ page }) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=nested");
  const parentTrigger = page.getByRole("button", { name: "Parent trigger" });
  const nestedTrigger = page.getByRole("button", { name: "Nested trigger" });
  const nestedAction = page.getByRole("button", { name: "Nested portaled action" });
  const parentCloseRequests = page.getByRole("status", { name: "Parent close requests" });

  const nestedContentId = await nestedTrigger.getAttribute("aria-controls");
  expect(nestedContentId).toBeTruthy();
  await expect(page.locator(`[id="${nestedContentId}"]`).getByRole("button")).toHaveAttribute(
    "id",
    "nested-action",
  );

  await nestedTrigger.focus();
  await nestedAction.focus();

  await expect(nestedAction).toBeFocused();
  await expect(parentTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(parentCloseRequests).toHaveText("0");
});

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

test("ARIA-linked overlays fall back from a foreign document while Chromium reflects their relationships", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=cross-document-aria");

  const helpTrigger = page.getByText("Cross-document help");
  const tooltip = page.getByRole("tooltip");
  const selectTrigger = page.getByRole("combobox", { name: "Cross-document choice" });
  const listbox = page.getByRole("listbox");

  await expect(tooltip).toBeVisible();
  await expect(listbox).toBeVisible();
  const tooltipId = await tooltip.getAttribute("id");
  const listboxId = await listbox.getAttribute("id");
  expect(
    await helpTrigger.evaluate(
      (trigger) => trigger.ariaDescribedByElements?.map((element) => element.id) ?? [],
    ),
  ).toEqual([tooltipId]);
  expect(
    await selectTrigger.evaluate(
      (trigger) => trigger.ariaControlsElements?.map((element) => element.id) ?? [],
    ),
  ).toEqual([listboxId]);

  const foreignFrame = page.getByTitle("Foreign portal target");
  expect(
    await foreignFrame.evaluate((frame) =>
      frame instanceof HTMLIFrameElement ? frame.contentDocument?.body.childElementCount : null,
    ),
  ).toBe(0);
});

test("focus trap reaches an explicitly visible descendant and skips display-none content", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/popover-focus.html?case=visibility-override-trap");

  const visibleOverride = page.getByRole("button", { name: "Visible override action" });
  const next = page.getByRole("button", { name: "Next action" });
  const displayNone = page.getByRole("button", {
    name: "Display none action",
    includeHidden: true,
  });
  const outside = page.getByRole("button", { name: "Outside trap" });

  await expect(visibleOverride).toBeFocused();
  await expect(displayNone).toBeHidden();

  await outside.focus();
  await expect(visibleOverride).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(visibleOverride).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(next).toBeFocused();
  await expect(displayNone).not.toBeFocused();
});
