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
  const updateButton = page.getByRole("button", { name: /Update configuration/i });
  await expect(updateButton).toBeVisible();
  await updateButton.click();

  await expect(page.getByLabel(/api key/i)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /api key/i })).toHaveCount(0);
  await expect(page.getByText(/^sk-/)).toHaveCount(0);

  await assertClientSafeDom(await page.locator("main").innerHTML());
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
  const remediation = page.getByRole("button", { name: /Test readiness/i });
  await expect(remediation).toBeFocused();
  await remediation.press("Enter");

  await expect(
    page
      .getByRole("main")
      .getByLabel(/Local endpoint unreachable/i)
      .first(),
  ).toBeVisible();
});
