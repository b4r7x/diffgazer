import { expect, test } from "@playwright/test";

test("closing a parent before its child restores the original connected opener", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/focus-restore-dialog.html");
  const parentOpener = page.getByRole("button", { name: "Open parent" });

  await parentOpener.click();
  await page.getByRole("button", { name: "Open child" }).click();
  await page.getByRole("button", { name: "Close parent beneath child" }).click();
  await expect(page.getByRole("dialog", { name: "Parent dialog" })).toBeHidden();

  await page.getByRole("button", { name: "Close child", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Child dialog" })).toBeHidden();
  await expect(parentOpener).toBeFocused();
});

test("closing a child before its parent restores each nearest surviving opener", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/focus-restore-dialog.html");
  const parentOpener = page.getByRole("button", { name: "Open parent" });

  await parentOpener.click();
  const childOpener = page.getByRole("button", { name: "Open child" });
  await childOpener.click();
  await page.getByRole("button", { name: "Close child", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Child dialog" })).toBeHidden();
  await expect(childOpener).toBeFocused();

  await page.getByRole("button", { name: "Close parent", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Parent dialog" })).toBeHidden();
  await expect(parentOpener).toBeFocused();
});
