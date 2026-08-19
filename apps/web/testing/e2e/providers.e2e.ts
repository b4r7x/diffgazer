import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { expect, test } from "@playwright/test";
import {
  assertClientSafeDom,
  assertClientSafePayload,
  mockProtectedProviderApi,
  PROVIDER_E2E_INIT,
} from "./provider-fixture";

test.beforeEach(() => {
  assertClientSafePayload(PROVIDER_E2E_INIT);
});

test("local setup never exposes credential input", async ({ page }) => {
  await mockProtectedProviderApi(page);
  await page.goto("/settings/providers");

  const localName = PRODUCT_REGISTRY["local-openai"].presentation.name;
  const localOption = page.getByRole("option", { name: localName });
  await expect(localOption).toBeVisible();
  await localOption.click();
  // A failed local check leads with Verify; setup lives behind More.
  await page.getByRole("button", { name: "More actions" }).click();
  const updateItem = page.getByRole("menuitem", { name: /Update configuration/i });
  await expect(updateItem).toBeVisible();
  await updateItem.click();

  await expect(page.getByLabel(/api key/i)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /api key/i })).toHaveCount(0);
  await expect(page.getByText(/^sk-/)).toHaveCount(0);

  await assertClientSafeDom(await page.locator("main").innerHTML());
});

test("provider actions render as one primary, one secondary and a More menu with Delete last", async ({
  page,
}) => {
  await mockProtectedProviderApi(page);
  await page.goto("/settings/providers");

  const localName = PRODUCT_REGISTRY["local-openai"].presentation.name;
  await page.getByRole("option", { name: localName }).click();

  const actionRow = page.getByRole("group", { name: "Provider actions" });
  await expect(actionRow).toHaveCount(1);

  const labels = await actionRow
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));

  expect(labels).toEqual(["Verify", "Select model", "More actions"]);
  await expect(page.getByText(/Available actions/i)).toHaveCount(0);

  await actionRow.getByRole("button", { name: "More actions" }).click();
  const menu = page.getByRole("menu", { name: "More actions" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    /Update configuration/,
    /Delete configuration/,
  ]);
  await expect(menu.getByRole("separator")).toHaveCount(1);
});

test("the active configuration shows an Active chip and keeps its primary out of the row", async ({
  page,
}) => {
  await mockProtectedProviderApi(page);
  await page.goto("/settings/providers");

  const geminiName = PRODUCT_REGISTRY.gemini.presentation.name;
  await page.getByRole("option", { name: geminiName }).click();

  const actionRow = page.getByRole("group", { name: "Provider actions" });
  await expect(actionRow.getByText("Active")).toBeVisible();
  const labels = await actionRow
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
  expect(labels).toEqual(["Change model", "More actions"]);
});

test("provider readiness remediation is keyboard reachable", async ({ page }) => {
  await mockProtectedProviderApi(page);
  await page.goto("/settings/providers");

  const localName = PRODUCT_REGISTRY["local-openai"].presentation.name;
  const listbox = page.getByRole("listbox", { name: "Providers" });
  await expect(listbox).toBeVisible();
  await page.getByRole("option", { name: localName }).click();
  await listbox.focus();

  await page.keyboard.press("ArrowRight");
  const remediation = page.getByRole("button", { name: /^Verify$/i });
  await expect(remediation).toBeFocused();
  await remediation.press("Enter");

  await expect(
    page
      .getByRole("main")
      .getByLabel(/Local conformance failed/i)
      .first(),
  ).toBeVisible();
});
