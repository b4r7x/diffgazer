import { expect, type Page, test } from "@playwright/test";

const providers = [
  { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
  { provider: "openrouter", hasApiKey: true, isActive: false, model: "openai/gpt-4o" },
];

const initResponse = {
  configPath: "/tmp/diffgazer/config.json",
  config: { provider: "gemini", model: "gemini-2.5-flash" },
  configured: true,
  project: { projectId: "responsive-contract", path: "/repo", trust: null },
  providers,
  settings: {
    agentExecution: "parallel",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    secretsStorage: "file",
    severityThreshold: "low",
    theme: "terminal",
  },
  setup: {
    hasModel: true,
    hasProvider: true,
    hasSecretsStorage: true,
    hasTrust: false,
    isConfigured: true,
    isReady: true,
    missing: [],
  },
};

const safeAreaInsets = { top: 40, right: 36, bottom: 56, left: 48 };

async function emulateSafeArea(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeAreaInsets });
}

const onboardingInitResponse = {
  configPath: "/tmp/diffgazer/config.json",
  config: { provider: "gemini", model: "gemini-2.5-flash" },
  configured: false,
  project: { projectId: "onboarding-responsive", path: "/repo", trust: null },
  providers: [{ provider: "gemini", hasApiKey: false, isActive: false }],
  settings: {
    agentExecution: "parallel",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    secretsStorage: null,
    severityThreshold: "low",
    theme: "terminal",
  },
  setup: {
    hasModel: false,
    hasProvider: false,
    hasSecretsStorage: false,
    hasTrust: false,
    isConfigured: false,
    isReady: false,
    missing: ["secretsStorage", "provider", "model"],
  },
};

async function mockOnboardingApi(page: Page) {
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/settings", (route) =>
    route.fulfill({ json: onboardingInitResponse.settings }),
  );
  await page.route("**/api/config/init", (route) =>
    route.fulfill({ json: onboardingInitResponse }),
  );
  await page.route("**/api/config/providers", (route) =>
    route.fulfill({
      json: {
        providers: onboardingInitResponse.providers,
      },
    }),
  );
}

async function mockProviderApi(page: Page) {
  await page.route("**/api/config/init", (route) => route.fulfill({ json: initResponse }));
  await page.route("**/api/config/providers", (route) =>
    route.fulfill({ json: { providers, activeProvider: "gemini" } }),
  );
  await page.route("**/api/config/provider/gemini/models", (route) =>
    route.fulfill({
      json: {
        models: [
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            description: "Fast model",
            tier: "free",
          },
        ],
        fetchedAt: "2026-01-01T00:00:00.000Z",
        source: "snapshot",
        cached: false,
      },
    }),
  );
}

test("onboarding progress shows compact text below md and the full stepper at md and above", async ({
  page,
}, testInfo) => {
  await mockOnboardingApi(page);
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: /secrets storage/i })).toBeVisible();

  const compactProgress = page.getByText("Step 1/6 · Storage");
  const fullProgress = page.getByRole("list", { name: "Setup progress" });

  if (testInfo.project.name === "mobile-chromium") {
    await expect(compactProgress).toBeVisible();
    await expect(fullProgress).toBeHidden();
  } else {
    await expect(compactProgress).toBeHidden();
    await expect(fullProgress).toBeVisible();
  }
});

test("provider panes and controls adapt to the rendered viewport", async ({ page }, testInfo) => {
  await mockProviderApi(page);
  await page.goto("/tests/fixtures/results-layout.html?view=providers");

  const listPane = page.locator('[data-layout-pane="provider-list"]');
  await expect(listPane).toBeVisible();
  await page.getByRole("option", { name: /Google Gemini/ }).click();
  const detailsPane = page.locator('[data-layout-pane="provider-details"]');
  await expect(detailsPane).toBeVisible();

  const listBounds = await listPane.boundingBox();
  const detailsBounds = await detailsPane.boundingBox();
  expect(listBounds).not.toBeNull();
  expect(detailsBounds).not.toBeNull();

  if (testInfo.project.name === "mobile-chromium") {
    expect(detailsBounds?.y).toBeGreaterThanOrEqual(
      (listBounds?.y ?? 0) + (listBounds?.height ?? 0),
    );
    expect(detailsBounds?.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);

    const coarseTargets = page.getByRole("group", { name: "Provider filter" }).getByRole("button");
    for (const target of await coarseTargets.all()) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  } else {
    expect(detailsBounds?.x).toBeGreaterThanOrEqual(
      (listBounds?.x ?? 0) + (listBounds?.width ?? 0),
    );
  }

  const capabilityGrid = page.locator('[data-layout-grid="provider-capabilities"]');
  const capabilityCards = capabilityGrid.locator("> div");
  const firstCard = await capabilityCards.nth(0).boundingBox();
  const secondCard = await capabilityCards.nth(1).boundingBox();
  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();
  if (testInfo.project.name === "mobile-chromium") {
    expect(secondCard?.y).toBeGreaterThanOrEqual((firstCard?.y ?? 0) + (firstCard?.height ?? 0));
  } else {
    expect(secondCard?.x).toBeGreaterThanOrEqual((firstCard?.x ?? 0) + (firstCard?.width ?? 0));
  }

  await page.getByRole("button", { name: "Select Model" }).click();
  const dialog = page.getByRole("dialog", { name: "Select Model" });
  await expect(dialog).toBeVisible();
  const modelList = dialog.locator('[data-layout-region="model-list"]');
  const listBox = await modelList.boundingBox();
  expect(listBox?.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) / 2);

  if (testInfo.project.name === "mobile-chromium") {
    const modelTargets = dialog
      .getByRole("group", { name: "Model tier filter" })
      .getByRole("button");
    for (const target of await modelTargets.all()) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("the rendered app shell consumes nonzero safe-area insets", async ({ page }, testInfo) => {
  await emulateSafeArea(page);
  await mockProviderApi(page);
  await page.goto("/tests/fixtures/results-layout.html?view=shell");

  const shell = page.locator('[data-layout="app-shell"]');
  const footer = page.locator("footer");
  await expect(shell).toBeVisible();
  await expect(footer).toBeVisible();

  const shellStyles = await shell.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingLeft: computed.paddingLeft,
    };
  });
  const footerPaddingBottom = await footer.evaluate(
    (element) => getComputedStyle(element).paddingBottom,
  );

  expect(shellStyles).toEqual({ paddingTop: "40px", paddingRight: "36px", paddingLeft: "48px" });
  expect(footerPaddingBottom).toBe("56px");

  const shortcutLegend = page.locator("[data-shortcut-legend]");
  const narrowWordmark = page.locator("header pre:not([role='img'])");
  const fullWordmark = page.getByRole("img", { name: "DIFFGAZER" });

  if (testInfo.project.name === "mobile-chromium") {
    await expect(shortcutLegend).toBeHidden();
    await expect(narrowWordmark).toBeVisible();
    await expect(fullWordmark).toBeHidden();
  } else {
    await expect(shortcutLegend).toBeVisible();
    await expect(narrowWordmark).toBeHidden();
    await expect(fullWordmark).toBeVisible();
  }
});

test("toast edges and coarse-pointer relocation use compiled positioning styles", async ({
  page,
}, testInfo) => {
  await emulateSafeArea(page);
  const position = testInfo.project.name === "mobile-chromium" ? "bottom-right" : "top-left";
  await page.goto(`/tests/fixtures/results-layout.html?view=toast&position=${position}`);
  await page.getByRole("button", { name: "Show notification" }).click();

  const region = page.getByRole("region", { name: "Notifications" });
  await expect(region.getByRole("status").getByText("Rendered notification")).toBeVisible();
  const styles = await region.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      top: computed.top,
      right: computed.right,
      bottom: computed.bottom,
      left: computed.left,
      flexDirection: computed.flexDirection,
    };
  });
  const bounds = await region.boundingBox();
  expect(bounds).not.toBeNull();

  if (testInfo.project.name === "mobile-chromium") {
    expect(styles).toMatchObject({ top: "40px", right: "36px" });
    expect(bounds?.y).toBe(40);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBe(
      (page.viewportSize()?.width ?? 0) - safeAreaInsets.right,
    );
    expect(styles.flexDirection).toBe("column");
  } else {
    expect(styles).toMatchObject({ top: "40px", left: "48px" });
    expect(bounds?.x).toBe(48);
    expect(bounds?.y).toBe(40);
    expect(styles.flexDirection).toBe("column");

    await page.goto("/tests/fixtures/results-layout.html?view=toast&position=bottom-right");
    await page.getByRole("button", { name: "Show notification" }).click();
    const bottomRegion = page.getByRole("region", { name: "Notifications" });
    await expect(bottomRegion.getByRole("status")).toBeVisible();
    const bottomBounds = await bottomRegion.boundingBox();
    expect(bottomBounds).not.toBeNull();
    expect((bottomBounds?.x ?? 0) + (bottomBounds?.width ?? 0)).toBe(
      (page.viewportSize()?.width ?? 0) - safeAreaInsets.right,
    );
    expect((bottomBounds?.y ?? 0) + (bottomBounds?.height ?? 0)).toBe(
      (page.viewportSize()?.height ?? 0) - safeAreaInsets.bottom,
    );
  }
});
