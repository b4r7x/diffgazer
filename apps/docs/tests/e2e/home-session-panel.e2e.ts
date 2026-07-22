import { expect, test } from "@playwright/test";

test.describe("Home session panel", () => {
  test("keeps a constant terminal height across the typing, reviewing, and settled phases", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/");

    const terminal = page.getByRole("img", { name: "Session terminal" });
    await expect(terminal).toBeVisible();
    const initialBox = await terminal.boundingBox();
    expect(initialBox).not.toBeNull();

    // Land inside the "reviewing" spinner window (starts once the command finishes typing
    // at START_DELAY + COMMAND.length * CHAR_INTERVAL ≈ 845ms).
    await page.clock.runFor(900);
    await expect(page.getByText(/reviewing 3 changed files/)).toBeVisible();
    const reviewingBox = await terminal.boundingBox();
    expect(reviewingBox).not.toBeNull();

    // Run well past the full animation timeline (settles by ≈3045ms) so the final line is up.
    await page.clock.runFor(4000);
    await expect(page.getByText(/press j\/k to browse the registry/)).toBeVisible();
    const settledBox = await terminal.boundingBox();
    expect(settledBox).not.toBeNull();

    expect(reviewingBox?.height).toBe(initialBox?.height);
    expect(settledBox?.height).toBe(initialBox?.height);
  });
});
