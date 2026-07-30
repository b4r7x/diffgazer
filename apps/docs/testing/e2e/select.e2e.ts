import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

async function getOpenListbox(page: Page, trigger: Locator): Promise<Locator> {
  const listboxId = await trigger.getAttribute("aria-controls");
  if (!listboxId) throw new Error("Select trigger did not expose aria-controls");

  const listbox = page.locator(`[id="${listboxId}"]`);
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute("data-positioned", "");
  return listbox;
}

async function expectDocumentFocus(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => element.ownerDocument.activeElement === element))
    .toBe(true);
}

// The page renders two `defaultOpen` examples; most tests isolate one Select so their
// focus and listbox assertions do not observe multiple open overlays.
const DEFAULT_OPEN_EXAMPLES = ["Framework", "Commands"] as const;

async function closeDefaultOpenExamples(page: Page): Promise<void> {
  for (const name of DEFAULT_OPEN_EXAMPLES) {
    const trigger = page.getByRole("combobox", { name, exact: true });
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });
    await trigger.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.locator('[role="combobox"][aria-expanded="true"]')).toHaveCount(0);
}

async function expectDefaultOpenExamplesAtPageTop(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
  for (const name of DEFAULT_OPEN_EXAMPLES) {
    const trigger = page.getByRole("combobox", { name, exact: true });
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });
    const listboxId = await trigger.getAttribute("aria-controls");
    if (!listboxId) throw new Error(`${name} did not expose aria-controls`);
    await expect(page.locator(`[id="${listboxId}"]`)).toHaveAttribute(
      "aria-activedescendant",
      /.+/,
    );
  }
  expect(await page.locator("#main-content").evaluate((element) => element.scrollTop)).toBe(0);
}

function getDefaultBranchTrigger(page: Page): Locator {
  return page
    .getByRole("main")
    .getByRole("tabpanel")
    .first()
    .getByRole("combobox", { name: "Branch" });
}

async function selectSecondBranch(
  page: Page,
  trigger: Locator,
  open: () => Promise<void>,
): Promise<void> {
  await open();
  const listbox = await getOpenListbox(page, trigger);
  await expectDocumentFocus(listbox);
  await page.keyboard.press("ArrowDown");
  await expect(listbox.getByRole("option", { name: "develop" })).toHaveAttribute(
    "data-highlighted",
    "",
  );
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("develop");
}

test.describe("Select", () => {
  test("keeps a direct load at the page top with default-open examples", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/ui/components/select");
    await expectDefaultOpenExamplesAtPageTop(page);
  });

  test("keeps cold sidebar navigation at the page top with default-open examples", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/ui/components/button");
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();
    await page.locator("#main-content").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => page.locator("#main-content").evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    await sidebar.getByRole("link", { name: "Select", exact: true }).click();

    await expect(page).toHaveURL(/\/ui\/components\/select$/);
    await expectDefaultOpenExamplesAtPageTop(page);
  });

  test("opens Branch on the first click while default-open examples are mounted", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    for (const name of DEFAULT_OPEN_EXAMPLES) {
      await expect(page.getByRole("combobox", { name, exact: true })).toHaveAttribute(
        "aria-expanded",
        "true",
        { timeout: 15_000 },
      );
    }

    const trigger = getDefaultBranchTrigger(page);
    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await getOpenListbox(page, trigger);
  });

  test("focuses the listbox after a pointer open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenExamples(page);
    const trigger = getDefaultBranchTrigger(page);

    await selectSecondBranch(page, trigger, () => trigger.click());
  });

  test("focuses the listbox after a keyboard open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenExamples(page);
    const trigger = getDefaultBranchTrigger(page);

    await selectSecondBranch(page, trigger, async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
    });
  });

  test("focuses the listbox after a programmatic open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenExamples(page);
    const trigger = getDefaultBranchTrigger(page);
    const triggerId = await trigger.getAttribute("id");
    if (!triggerId) throw new Error("Select trigger did not expose an id");

    await selectSecondBranch(page, trigger, () =>
      page.evaluate((id) => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) activeElement.blur();
        if (document.activeElement !== document.body) {
          throw new Error("Programmatic Select open requires unowned document focus");
        }
        const element = document.getElementById(id);
        if (!(element instanceof HTMLElement)) throw new Error("Select trigger is not an element");
        element.click();
      }, triggerId),
    );
  });

  test("focuses the search input after a searchable open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenExamples(page);
    const searchablePreview = page
      .getByRole("heading", { level: 4, name: "Searchable (bottom)" })
      .locator("..");
    const trigger = searchablePreview.getByRole("button", { name: "Command" });

    await trigger.click();
    const searchInput = page
      .getByRole("listbox", { name: "Command" })
      .locator("..")
      .getByRole("combobox", { name: "Search options" });
    await expect(searchInput).toBeVisible();
    await expectDocumentFocus(searchInput);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(trigger).toContainText("git commit");
  });

  test("opens listbox via keyboard and reports no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/select");
    await expect(page.getByRole("heading", { level: 1, name: /select/i })).toBeVisible();
    await closeDefaultOpenExamples(page);

    const combo = page.getByRole("main").getByRole("combobox").first();
    await combo.focus();
    await page.keyboard.press("Enter");

    const listboxId = await combo.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    const listbox = page.locator(`[id="${listboxId}"]`);
    await expect(listbox).toBeVisible();
    await expect(listbox).toHaveAttribute("data-positioned", "");
    await expect(listbox).toHaveAttribute("data-side", "bottom");
    await expect(listbox).toHaveAttribute("data-align", "start");
    await expect
      .poll(async () => {
        const before = await listbox.boundingBox();
        await page.evaluate(
          () =>
            new Promise<void>((resolveFrame) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
            }),
        );
        const after = await listbox.boundingBox();

        return (
          before !== null && after !== null && JSON.stringify(after) === JSON.stringify(before)
        );
      })
      .toBe(true);
    const listboxSize = await listbox.evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
    expect(listboxSize).toEqual({ width: 256, height: 162 });

    // Pin only this panel inside the viewport so fractional anchor coordinates cannot alter its clip.
    const snapshotInset = 100;
    const snapshotSelector = await listbox.evaluate((element) => `#${CSS.escape(element.id)}`);
    const snapshotStyle = await page.addStyleTag({
      content: `${snapshotSelector} { top: ${snapshotInset}px !important; left: ${snapshotInset}px !important; }`,
    });
    const snapshotRect = await listbox.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    expect(snapshotRect).toEqual({
      x: snapshotInset,
      y: snapshotInset,
      width: 256,
      height: 162,
    });
    await expect(listbox).toHaveScreenshot("select-listbox-open.png");
    await snapshotStyle.evaluate((element) => element.parentNode?.removeChild(element));

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
  });
});
