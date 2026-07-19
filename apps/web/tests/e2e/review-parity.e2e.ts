import { join } from "node:path";
import { canonicalReviewFixture, reviewFacts } from "@diffgazer/core/testing/review-facts";
import { expect, test } from "@playwright/test";

const facts = reviewFacts(canonicalReviewFixture);

test("the review summary exposes every aggregate review fact", async ({ page }) => {
  await page.goto("/tests/fixtures/results-layout.html?view=summary");

  await expect(page.getByRole("heading", { name: `Review Complete ${facts.runId}` })).toBeVisible();

  for (const fact of facts.severityCounts) {
    await expect(page.getByRole("meter", { name: fact.label })).toHaveAttribute(
      "aria-valuenow",
      String(fact.count),
    );
  }

  const categoryTable = page.getByRole("table").filter({
    has: page.getByRole("columnheader", { name: "Category" }),
  });
  for (const fact of facts.categoryRows) {
    await expect(
      categoryTable.getByRole("row", { name: `${fact.label} ${fact.count}` }),
    ).toBeVisible();
  }

  const lensTable = page.getByRole("table", { name: "Issues by lens" });
  for (const fact of facts.lensRows) {
    await expect(
      lensTable.getByRole("row", { name: `${fact.label} ${fact.issueCount}` }),
    ).toBeVisible();
  }

  if (facts.duplicateCollapseNotice) {
    await expect(page.getByRole("note")).toHaveText(facts.duplicateCollapseNotice);
  }
});

test("the results reader exposes every issue review fact", async ({ page }) => {
  await page.goto("/tests/fixtures/results-layout.html?view=results");

  await expect(page.getByText(`Review ${facts.runId}`, { exact: true })).toBeVisible();
  const issueList = page.getByRole("listbox", { name: "Issues" });
  const details = page.getByRole("complementary", { name: "Issue details" });

  for (const [index, title] of facts.issueTitles.entries()) {
    const location = facts.issueLocations[index];
    if (!location) throw new Error(`Missing location fact for ${title}`);
    const issue = issueList.getByRole("option").filter({ hasText: title });
    await expect(issue).toHaveCount(1);
    await issue.click();
    await expect(details.getByText(location, { exact: true })).toBeVisible();
  }

  if (facts.duplicateCollapseNotice) {
    await expect(page.getByRole("note")).toHaveText(facts.duplicateCollapseNotice);
  }
});

test("@parity the results layout matches the desktop and mobile baselines", async ({
  page,
}, testInfo) => {
  await page.goto("/tests/fixtures/results-layout.html?view=results");

  const results = page.locator("main");
  await expect(results).toBeVisible();
  await expect(results).toHaveScreenshot("results-layout.png", {
    mask: [page.getByText(`Review ${facts.runId}`, { exact: true })],
  });

  const captureDir = process.env.DIFFGAZER_PARITY_CAPTURE_DIR;
  if (captureDir) {
    await results.screenshot({
      animations: "disabled",
      mask: [page.getByText(`Review ${facts.runId}`, { exact: true })],
      path: join(captureDir, `web-${testInfo.project.name}.png`),
    });
  }
});
