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

test("provider panes and controls adapt to the rendered viewport", async ({ page }, testInfo) => {
  await mockProviderApi(page);
  await page.goto("/tests/fixtures/results-layout.html?view=providers");

  const listPane = page.getByRole("heading", { name: "Providers", exact: true }).locator("../..");
  await expect(listPane).toBeVisible();
  await page.getByRole("option", { name: /Google Gemini/ }).click();
  const detailsPane = page
    .getByRole("heading", { name: "Provider Details: Google Gemini" })
    .locator("../../..");
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

  const capabilityCards = page
    .getByText("Tool Calling")
    .locator("..")
    .locator("..")
    .locator("> div");
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
  const modelList = dialog.getByRole("radiogroup", { name: "Available models" }).locator("..");
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

test("the rendered app shell consumes nonzero safe-area insets", async ({ page }) => {
  await emulateSafeArea(page);
  await mockProviderApi(page);
  await page.goto("/tests/fixtures/results-layout.html?view=shell");

  const shell = page.getByText("Shell content").locator("../..");
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
