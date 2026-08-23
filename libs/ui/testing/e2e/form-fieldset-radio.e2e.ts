import { expect, type Locator, test } from "@playwright/test";

async function formEntries(form: Locator): Promise<Array<[string, string]>> {
  return form.evaluate((element) => {
    if (!(element instanceof HTMLFormElement)) throw new Error("Expected form fixture");
    return Array.from(new FormData(element).entries()).map(([key, value]) => [key, String(value)]);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/testing/fixtures/form-fieldset-radio.html");
});

test("disabled fieldsets gate standalone and grouped controls except the first legend", async ({
  page,
}) => {
  const form = page.locator("#fieldset-form");
  const events = page.getByRole("status", { name: "Fieldset events" });
  const outsideControls = [
    page.getByRole("checkbox", { name: "Outside checkbox" }),
    page.getByRole("checkbox", { name: "Apple" }),
    page.getByRole("radio", { name: "Outside radio" }),
    page.getByRole("radio", { name: "Red", exact: true }),
    page.getByRole("checkbox", { name: "Second legend checkbox" }),
  ];

  for (const control of outsideControls) {
    await expect(control).toHaveAttribute("aria-disabled", "true");
    await expect(control).toHaveAttribute("tabindex", "-1");
    await control.click({ force: true });
    await control.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
  }

  await expect(events).toHaveText("0");
  expect(await formEntries(form)).toEqual([
    ["legend-check", "yes"],
    ["legend-radio", "yes"],
  ]);
  await expect(
    page.getByRole("checkbox", { name: "Legend checkbox", exact: true }),
  ).not.toHaveAttribute("aria-disabled");
  await expect(page.getByRole("radio", { name: "Legend radio" })).not.toHaveAttribute(
    "aria-disabled",
  );

  await page.getByRole("button", { name: "Before fieldset" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: "Legend checkbox", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Legend radio" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Toggle fieldset" })).toBeFocused();

  await page.getByRole("button", { name: "Toggle fieldset" }).click();
  for (const control of outsideControls) await expect(control).not.toHaveAttribute("aria-disabled");
  expect(await formEntries(form)).toEqual([
    ["legend-check", "yes"],
    ["legend-radio", "yes"],
    ["outside-check", "yes"],
    ["fruits", "apple"],
    ["outside-radio", "yes"],
    ["color", "red"],
    ["second-legend", "yes"],
  ]);

  await page.getByRole("button", { name: "Toggle fieldset" }).click();
  for (const control of outsideControls) {
    await expect(control).toHaveAttribute("aria-disabled", "true");
    await expect(control).toHaveAttribute("tabindex", "-1");
  }
  expect(await formEntries(form)).toEqual([
    ["legend-check", "yes"],
    ["legend-radio", "yes"],
  ]);
});

test("initially CSS-hidden selection leaves forward and reverse Tab entry on a visible radio", async ({
  page,
}) => {
  const before = page.getByRole("button", { name: "Initial before" });
  const blue = page.getByRole("radio", { name: "Initial blue" });
  const after = page.getByRole("button", { name: "Initial after" });

  await expect(blue).toHaveAttribute("tabindex", "0");
  await before.focus();
  await page.keyboard.press("Tab");
  await expect(blue).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(blue).toBeFocused();
});

/**
 * The two ways a stylesheet can take the selected radio out of the Tab order are
 * covered by this file: hidden by a rule already in the cascade (the test above,
 * read through getComputedStyle at mount) and hidden by a DOM change the group
 * observes (below — the ancestor class flip, seen by the MutationObserver in
 * selectable-collection-observer.ts).
 *
 * A rule mutated at runtime through the CSSOM alone changes no DOM node and is
 * deliberately not covered: patching CSSStyleSheet.prototype to catch it is not
 * a trade the library takes.
 */
test("external ancestor changes retarget radio Tab entry", async ({ page }) => {
  const dynamicRed = page.locator('[role="radio"][data-value="dynamic-red"]');
  const dynamicBlue = page.getByRole("radio", { name: "Dynamic blue" });
  await expect(dynamicRed).toHaveAttribute("tabindex", "0");
  await page.getByRole("button", { name: "Toggle selected ancestor" }).click();
  await expect(dynamicRed).toHaveAttribute("tabindex", "-1");
  await expect(dynamicBlue).toHaveAttribute("tabindex", "0");

  const dynamicBefore = page.getByRole("button", { name: "Dynamic before" });
  const dynamicAfter = page.getByRole("button", { name: "Dynamic after" });
  await dynamicBefore.focus();
  await page.keyboard.press("Tab");
  await expect(dynamicBlue).toBeFocused();
  await dynamicAfter.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Toggle selected ancestor" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dynamicBlue).toBeFocused();
});

test("default-selected and first-enabled group items are the Chromium Tab stops", async ({
  page,
}) => {
  const expectedTabOrder = [
    page.getByRole("radio", { name: "Selected radio" }),
    page.getByRole("radio", { name: "Fallback radio" }),
    page.getByRole("radio", { name: "Selected toggle" }),
    page.getByRole("radio", { name: "Fallback toggle" }),
    page.getByRole("button", { name: "Seed after" }),
  ];

  await page.getByRole("button", { name: "Seed before" }).focus();
  for (const target of expectedTabOrder) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  }
});
