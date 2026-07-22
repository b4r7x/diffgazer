import { expect, type Locator, test } from "@playwright/test";

interface TextareaMetrics {
  fontSize: number;
  paddingLeft: number;
  paddingTop: number;
  minHeight: number;
  resize: string;
}

async function readMetrics(textarea: Locator): Promise<TextareaMetrics> {
  return textarea.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingTop: Number.parseFloat(style.paddingTop),
      minHeight: Number.parseFloat(style.minHeight),
      resize: style.resize,
    };
  });
}

test.describe("Textarea sizes", () => {
  test("Small, Medium, and Large scale padding and font size while every example shares the resizable baseline", async ({
    page,
  }) => {
    await page.goto("/ui/components/textarea");
    await expect(page.getByRole("heading", { level: 1, name: /textarea/i })).toBeVisible();

    const small = await readMetrics(page.getByRole("textbox", { name: "Small" }));
    const medium = await readMetrics(page.getByRole("textbox", { name: "Medium (default)" }));
    const large = await readMetrics(page.getByRole("textbox", { name: "Large" }));

    expect(small.fontSize).toBeLessThan(medium.fontSize);
    expect(medium.fontSize).toBeLessThan(large.fontSize);
    expect(small.paddingLeft).toBeLessThan(medium.paddingLeft);
    expect(medium.paddingLeft).toBeLessThan(large.paddingLeft);
    expect(small.paddingTop).toBeLessThan(medium.paddingTop);

    const textareas = page.getByRole("textbox");
    const count = await textareas.count();
    expect(count).toBeGreaterThanOrEqual(6);
    expect(small.minHeight).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const metrics = await readMetrics(textareas.nth(index));
      expect(metrics.minHeight).toBe(small.minHeight);
      expect(metrics.resize).toBe("vertical");
    }
  });
});
