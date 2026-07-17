import { expect, type Locator, test } from "@playwright/test";

async function formEntries(form: Locator): Promise<Array<[string, string]>> {
  return form.evaluate((element) => {
    if (!(element instanceof HTMLFormElement)) throw new Error("Expected form fixture");
    return Array.from(new FormData(element).entries()).map(([key, value]) => [key, String(value)]);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/fixtures/form-fieldset-radio.html");
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

test("external ancestor and stylesheet changes retarget radio Tab entry", async ({ page }) => {
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

  const ruleRed = page.locator('[role="radio"][data-value="rule-red"]');
  const ruleBlue = page.getByRole("radio", { name: "Rule blue" });
  await expect(ruleRed).toHaveAttribute("tabindex", "0");
  const insertRule = page.getByRole("button", { name: "Hide selected with insertRule" });
  await insertRule.click();
  await expect(ruleRed).toHaveAttribute("tabindex", "-1");
  await expect(ruleBlue).toHaveAttribute("tabindex", "0");

  await page.getByRole("button", { name: "Rule before" }).focus();
  await page.keyboard.press("Tab");
  await expect(ruleBlue).toBeFocused();
  await insertRule.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(ruleBlue).toBeFocused();

  await page.getByRole("button", { name: "Show selected with deleteRule" }).click();
  await expect(ruleRed).toHaveAttribute("tabindex", "0");
  await expect(ruleBlue).toHaveAttribute("tabindex", "-1");

  await page.getByRole("button", { name: "Hide selected with replaceSync" }).click();
  await expect(ruleRed).toHaveAttribute("tabindex", "-1");
  await expect(ruleBlue).toHaveAttribute("tabindex", "0");
  await page.getByRole("button", { name: "Show selected with replaceSync" }).click();
  await expect(ruleRed).toHaveAttribute("tabindex", "0");
  await expect(ruleBlue).toHaveAttribute("tabindex", "-1");

  await page.getByRole("button", { name: "Hide selected with replace", exact: true }).click();
  await expect(ruleRed).toHaveAttribute("tabindex", "-1");
  await expect(ruleBlue).toHaveAttribute("tabindex", "0");
  await page.getByRole("button", { name: "Show selected with replace", exact: true }).click();
  await expect(ruleRed).toHaveAttribute("tabindex", "0");
  await expect(ruleBlue).toHaveAttribute("tabindex", "-1");
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
