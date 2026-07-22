import { expect, test } from "@playwright/test";

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
