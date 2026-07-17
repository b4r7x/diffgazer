import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 720 },
  { width: 640, height: 720 },
];

for (const viewport of viewports) {
  test(`dialog footer keeps localized actions inside a ${viewport.width}px viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ui/components/dialog");
    const trigger = page.getByRole("button", { name: /open dialog/i }).first();

    const openLocalizedDialog = async () => {
      await trigger.click();
      const dialog = page.getByRole("dialog").first();
      const footer = dialog.locator('[data-slot="dialog-footer"]').first();
      const actions = footer.locator('[data-slot="dialog-footer-actions"]');
      const buttons = actions.getByRole("button");
      await expect(buttons).toHaveCount(2);
      await buttons.nth(0).evaluate((button) => {
        button.textContent = "Anuluj wprowadzone zmiany";
      });
      await buttons.nth(1).evaluate((button) => {
        button.textContent = "Zapisz i kontynuuj dalej";
      });
      await expect(buttons.nth(0)).toHaveAccessibleName("Anuluj wprowadzone zmiany");
      await expect(buttons.nth(1)).toHaveAccessibleName("Zapisz i kontynuuj dalej");
      return { buttons, dialog, footer };
    };

    const { buttons, dialog, footer } = await openLocalizedDialog();

    const geometry = await footer.evaluate((node) => {
      const actionButtons = Array.from(
        node.querySelectorAll<HTMLElement>('[data-slot="dialog-footer-actions"] button'),
      );
      const footerRect = node.getBoundingClientRect();
      return {
        documentFits: document.documentElement.scrollWidth <= window.innerWidth,
        footerFits: footerRect.left >= 0 && footerRect.right <= window.innerWidth,
        actionsFit: actionButtons.every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= footerRect.left && rect.right <= footerRect.right;
        }),
        rows: new Set(actionButtons.map((button) => button.getBoundingClientRect().top)).size,
      };
    });

    expect(geometry.documentFits).toBe(true);
    expect(geometry.footerFits).toBe(true);
    expect(geometry.actionsFit).toBe(true);
    expect(geometry.rows).toBe(viewport.width === 320 ? 2 : 1);

    await buttons.nth(1).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();

    const reopened = await openLocalizedDialog();
    await reopened.buttons.nth(0).focus();
    await page.keyboard.press("Space");
    await expect(reopened.dialog).toBeHidden();
  });
}
