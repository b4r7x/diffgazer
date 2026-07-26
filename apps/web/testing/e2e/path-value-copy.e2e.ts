import { expect, type Locator, test } from "@playwright/test";

/**
 * PathValue middle-truncates by splitting a path into two inline boxes, so what the
 * reader copies is assembled by the browser's own serializer rather than by us. That
 * is invisible to jsdom and to any DOM assertion: laying the two halves out as block
 * boxes (flex items, the shape this component started as) makes the serializer put a
 * line break between them, and the copied location becomes a two-line string that no
 * shell, editor, or issue tracker will accept. Only a real selection in a real engine
 * can see it, so this spec makes one.
 *
 * A path in this app never contains whitespace, which makes "no whitespace at all"
 * the honest assertion — stronger than looking for `\n` and independent of the title
 * attribute the component also derives from the same value.
 */
const NARROW_VIEWPORT = { height: 667, width: 375 };

/** Selects the element's rendered contents and returns what the clipboard would get. */
async function copyText(pathValue: Locator): Promise<string> {
  return pathValue.evaluate((element) => {
    const selection = window.getSelection();
    if (selection === null) throw new Error("no selection available");
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = selection.toString();
    selection.removeAllRanges();
    return copied;
  });
}

test("copies a path as one unbroken line whether it wraps or truncates", async ({ page }) => {
  await page.setViewportSize(NARROW_VIEWPORT);
  await page.goto("/testing/fixtures/results-layout.html?view=results");

  // Case 1: the issue list subtitle, where the path is narrow enough that the tail
  // drops to a second line box.
  const listed = page.getByRole("listbox", { name: "Issues" }).getByRole("option").first();
  await expect(listed).toBeVisible();
  const listedPath = listed.locator("[title]");

  const lineBoxes = await listedPath.evaluate((element) => element.getClientRects().length);
  expect(
    lineBoxes,
    "the listed path has to actually wrap for this case to mean anything",
  ).toBeGreaterThan(1);

  const copiedFromList = await copyText(listedPath);
  expect(copiedFromList).not.toMatch(/\s/);
  expect(copiedFromList).toBe(await listedPath.getAttribute("title"));

  // Case 2: the issue header, where the leading segments are ellipsized instead.
  await listed.click();
  const details = page.getByRole("complementary", { name: "Issue details" });
  await expect(details).toBeVisible();
  const headerPath = details.locator("[title]");

  const clippedBy = await headerPath.evaluate((element) => {
    const head = element.firstElementChild;
    return head === null ? 0 : head.scrollWidth - head.clientWidth;
  });
  expect(
    clippedBy,
    "the header path has to actually truncate for this case to mean anything",
  ).toBeGreaterThan(0);

  const copiedFromHeader = await copyText(headerPath);
  expect(copiedFromHeader).not.toMatch(/\s/);
  expect(copiedFromHeader).toBe(await headerPath.getAttribute("title"));
});
