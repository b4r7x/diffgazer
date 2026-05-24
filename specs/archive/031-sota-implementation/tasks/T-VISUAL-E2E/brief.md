# Task T-VISUAL-E2E — Playwright + axe + visual snapshots in CI

**Source findings:** NEW-032
**Severity:** High (zero browser-rendered tests in CI today)
**Phase:** 5
**Blocks:** none
**Blocked by:** T-DOCS-SITE (Playwright runs against docs site), T-VITE-ALIAS (build must work)

## Goal
CI workflow has install + build + verify + smoke + pack — NO browser job. 272 Vitest files all run in jsdom. Add Playwright with: (a) smoke specs for 8-10 critical primitives, (b) `@axe-core/playwright` for real-browser a11y, (c) `toHaveScreenshot` baseline snapshots for visual regression. Run on Chromium minimum.

## Files to touch (allowlist)
- `apps/docs/playwright.config.ts` (NEW)
- `apps/docs/tests/e2e/*.spec.ts` (NEW — 8-10 specs)
- `apps/docs/package.json` (add `@playwright/test`, `@axe-core/playwright` dev deps; add `test:e2e` script)
- `.github/workflows/release-readiness.yml` (add `e2e` job after build)
- `.gitignore` (add `apps/docs/playwright-report`, `apps/docs/test-results`)
- `apps/docs/tests/e2e/baselines/` (NEW — checked-in screenshot baselines for chromium)

## Files NOT to touch
- Existing Vitest unit tests
- Component source
- Other test infra

## Acceptance criteria
- [ ] `pnpm --filter @diffgazer/docs test:e2e` runs Playwright against `pnpm --filter @diffgazer/docs preview` (or against a built preview server)
- [ ] At least 8 specs covering: Button (axe + screenshot), Dialog open/close/focus, Select open/keyboard, Popover hover/focus, Menu keyboard nav, Tooltip touch + focus, Tabs keyboard, Accordion expand/collapse, CommandPalette filter, Toast appear/dismiss
- [ ] Each spec calls `injectAxe` + `checkA11y` after key interactions
- [ ] Each spec calls `toHaveScreenshot` for stable visual baselines (only chromium, only light theme)
- [ ] CI job `e2e` runs on PR, downloads built preview, runs Playwright, uploads HTML report as artifact
- [ ] Baseline screenshots committed; flaky tests use `maxDiffPixelRatio: 0.01` tolerance
- [ ] `pnpm install` succeeds
- [ ] All existing tests still pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm install
pnpm --filter @diffgazer/docs exec playwright install --with-deps chromium
pnpm --filter @diffgazer/docs build
pnpm --filter @diffgazer/docs test:e2e
ls apps/docs/playwright-report apps/docs/tests/e2e/baselines
```

## Notes & references
- Spec 029 §NEW-032
- Playwright: https://playwright.dev
- @axe-core/playwright: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
- Reference: Radix UI, Ark UI, shadcn/ui all use Playwright

## Non-goals
- Do not add Firefox / WebKit matrix in this task (chromium first; matrix is follow-up)
- Do not replace Vitest unit tests
- Do not add visual regression for `apps/web` (separate scope)
- Do not add E2E for `dgadd` CLI (different test type)

## Suggested spec template

```ts
// apps/docs/tests/e2e/button.spec.ts
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

test("Button: primary variant a11y + visual", async ({ page }) => {
  await page.goto("/ui/docs/components/button");
  const button = page.getByRole("button", { name: /primary/i }).first();
  await expect(button).toBeVisible();
  await expect(button).toHaveScreenshot("button-primary.png");
  await injectAxe(page);
  await checkA11y(page);
});
```
