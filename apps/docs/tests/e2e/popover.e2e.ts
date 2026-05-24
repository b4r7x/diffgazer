import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("Popover", () => {
	test("opens on click and exposes accessible content", async ({ page }) => {
		await page.goto("/ui/components/popover")
		await expect(page.getByRole("heading", { level: 1, name: /popover/i })).toBeVisible()

		const trigger = page.getByRole("button", { name: /click me/i }).first()
		await trigger.click()
		await expect(trigger).toHaveAttribute("aria-expanded", "true")

		const contentId = await trigger.getAttribute("aria-controls")
		expect(contentId).toBeTruthy()
		const popover = page.locator(`[id="${contentId}"]`)
		await expect(popover).toBeVisible()
		await expect(popover).toContainText("Popover content")
		await expect(popover).toHaveScreenshot("popover-open.png")

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze()
		expect(results.violations).toEqual([])
	})
})
