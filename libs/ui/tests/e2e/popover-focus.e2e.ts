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
