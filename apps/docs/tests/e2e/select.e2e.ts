import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("Select", () => {
	test("opens listbox via keyboard and reports no a11y violations", async ({ page }) => {
		await page.goto("/ui/docs/components/select")
		await expect(page.getByRole("heading", { level: 1, name: /select/i })).toBeVisible()

		const combo = page.getByRole("combobox").first()
		await combo.focus()
		await page.keyboard.press("Enter")

		const listbox = page.getByRole("listbox").first()
		await expect(listbox).toBeVisible()
		await expect(listbox).toHaveScreenshot("select-listbox-open.png")

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze()
		expect(results.violations).toEqual([])

		await page.keyboard.press("Escape")
		await expect(listbox).toBeHidden()
	})
})
