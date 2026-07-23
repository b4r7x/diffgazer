import { expect, test } from "@playwright/test";

const focusReachabilityCases = [
  { state: "content-visibility:hidden", placement: "self", isReachable: false },
  { state: "content-visibility:hidden", placement: "ancestor", isReachable: false },
  { state: "hidden=until-found", placement: "self", isReachable: false },
  { state: "hidden=until-found", placement: "ancestor", isReachable: false },
  { state: "visibility:collapse", placement: "self", isReachable: false },
  { state: "visibility:collapse", placement: "ancestor", isReachable: false },
  { state: "content-visibility:auto", placement: "self", isReachable: true },
  { state: "content-visibility:auto", placement: "ancestor", isReachable: true },
] satisfies ReadonlyArray<{
  state:
    | "content-visibility:hidden"
    | "hidden=until-found"
    | "visibility:collapse"
    | "content-visibility:auto";
  placement: "self" | "ancestor";
  isReachable: boolean;
}>;

test.describe("Docs navigation", () => {
  test("desktop sidebar links navigate between docs pages", async ({ page }) => {
    await page.goto("/ui/components/button");
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();

    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    await expect(sidebar).toBeVisible();

    await sidebar.getByRole("link", { name: "Accordion" }).click();

    await expect(page).toHaveURL(/\/ui\/components\/accordion$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accordion" })).toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("mobile drawer opens, navigates, and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ui/components/button");
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();

    const menuButton = page.getByRole("button", { name: /open navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const scrim = page.getByRole("button", { name: /close sidebar navigation/i });
    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    const sidebarLinks = sidebar.getByRole("link");
    const lastSidebarLink = sidebarLinks.last();
    const initialDrawerControl = sidebar.getByRole("combobox", {
      name: "Select documentation library",
    });
    const skipLink = page.getByRole("link", { name: "Skip to content", includeHidden: true });
    const searchButton = page.getByRole("button", { name: /^search docs/i, includeHidden: true });

    await expect(scrim).toBeVisible();
    await expect(initialDrawerControl).toBeFocused();
    expect(await skipLink.evaluate((element) => element.closest("[inert]") !== null)).toBe(true);

    await lastSidebarLink.focus();
    await page.keyboard.press("Tab");
    await expect(scrim).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(lastSidebarLink).toBeFocused();

    await skipLink.focus();
    await expect(lastSidebarLink).toBeFocused();
    await searchButton.focus();
    await expect(lastSidebarLink).toBeFocused();

    await sidebar.getByRole("link", { name: "Accordion" }).click();

    await expect(page).toHaveURL(/\/ui\/components\/accordion$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accordion" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /close sidebar navigation/i, includeHidden: true }),
    ).toHaveAttribute("inert", "");
    await expect(
      page.getByRole("complementary", { name: /sidebar navigation/i, includeHidden: true }),
    ).toHaveAttribute("inert", "");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(await skipLink.evaluate((element) => element.closest("[inert]") === null)).toBe(true);
  });

  test("mobile drawer focus trap skips closed details descendants at both boundaries", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ui/components/button");
    await page.getByRole("button", { name: /open navigation menu/i }).click();

    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    const scrim = page.getByRole("button", { name: /close sidebar navigation/i });
    await sidebar.evaluate((element) => {
      const details = document.createElement("details");
      details.id = "focus-trap-closed-details";
      details.open = true;
      details.innerHTML =
        '<summary>Advanced navigation</summary><button type="button">Hidden action</button>';
      element.append(details);

      const outside = document.createElement("button");
      outside.id = "focus-trap-outside";
      outside.textContent = "Outside trap";
      document.body.append(outside);
    });

    const summary = page.locator("#focus-trap-closed-details summary");
    const hiddenAction = page.locator("#focus-trap-closed-details button");
    const initialDrawerControl = sidebar.getByRole("combobox", {
      name: "Select documentation library",
    });
    await hiddenAction.focus();
    await expect(hiddenAction).toBeFocused();
    await page.locator("#focus-trap-closed-details").evaluate((element) => {
      element.removeAttribute("open");
    });
    await expect(initialDrawerControl).toBeFocused();

    await summary.focus();
    await expect(summary).toBeFocused();
    await expect(hiddenAction).toBeHidden();

    await page.keyboard.press("Tab");
    await expect(scrim).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(summary).toBeFocused();
    await expect(page.locator("#focus-trap-outside")).not.toBeFocused();
  });

  test("mobile drawer follows composed Tab order through an open shadow root", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ui/components/button");
    await page.getByRole("button", { name: /open navigation menu/i }).click();

    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    const scrim = page.getByRole("button", { name: /close sidebar navigation/i });
    const lastSidebarLink = sidebar.getByRole("link").last();
    await sidebar.evaluate((element) => {
      const host = document.createElement("div");
      host.id = "focus-trap-shadow-host";
      const shadowRoot = host.attachShadow({ mode: "open", delegatesFocus: true });
      shadowRoot.innerHTML = `
        <button type="button">Shadow action one</button>
        <button type="button">Shadow action two</button>
      `;
      element.append(host);
    });

    const firstShadowAction = page.getByRole("button", { name: "Shadow action one" });
    const lastShadowAction = page.getByRole("button", { name: "Shadow action two" });

    await lastSidebarLink.focus();
    await page.keyboard.press("Tab");
    await expect(firstShadowAction).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(lastShadowAction).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(scrim).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(lastShadowAction).toBeFocused();
  });

  test.describe("mobile drawer focus trap browser reachability", () => {
    for (const focusCase of focusReachabilityCases) {
      test(`${focusCase.state} on ${focusCase.placement}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/ui/components/button");
        await page.getByRole("button", { name: /open navigation menu/i }).click();

        const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
        const scrim = page.getByRole("button", { name: /close sidebar navigation/i });
        await expect(
          sidebar.getByRole("combobox", { name: "Select documentation library" }),
        ).toBeFocused();
        await sidebar.evaluate((element, matrixCase) => {
          const boundary = document.createElement("button");
          boundary.type = "button";
          boundary.textContent = "Matrix boundary";
          element.append(boundary);

          const target = document.createElement("button");
          target.id = "focus-trap-reachability-target";
          target.type = "button";
          target.textContent = "Matrix target";
          const styledElement =
            matrixCase.placement === "self" ? target : document.createElement("div");

          if (matrixCase.state === "hidden=until-found") {
            styledElement.setAttribute("hidden", "until-found");
          } else {
            styledElement.setAttribute("style", matrixCase.state);
          }

          if (styledElement === target) element.append(target);
          else {
            styledElement.append(target);
            element.append(styledElement);
          }
        }, focusCase);

        const boundary = sidebar.getByRole("button", { name: "Matrix boundary" });
        const target = page.locator("#focus-trap-reachability-target");
        const accessibleTarget = page.getByRole("button", { name: "Matrix target" });

        await boundary.focus();
        await expect(boundary).toBeFocused();
        await page.keyboard.press("Tab");

        if (focusCase.isReachable) {
          await expect(accessibleTarget).toBeVisible();
          await expect(target).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(scrim).toBeFocused();
          await page.keyboard.press("Shift+Tab");
          await expect(target).toBeFocused();
          return;
        }

        await expect(scrim).toBeFocused();
        await expect(target).not.toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(boundary).toBeFocused();
        await expect(target).not.toBeFocused();
      });
    }
  });
});
