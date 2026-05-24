import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("Button", () => {
	test("default examples render with no a11y violations", async ({ page }) => {
		await page.goto("/ui/components/button")
		const heading = page.getByRole("heading", { level: 1, name: /button/i })
		await expect(heading).toBeVisible()

		const firstButton = page.getByRole("button", { name: /submit/i }).first()
		await expect(firstButton).toBeVisible()
		await expect(firstButton).toHaveScreenshot("button-primary.png")

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze()
		expect(results.violations).toEqual([])
	})
})
