import { expect, test } from "@playwright/test";

interface HiddenPanelProbe {
  samples: number;
  maxOpacity: number;
  animationNames: string[];
}

declare global {
  interface Window {
    __hiddenPanelProbe?: HiddenPanelProbe;
  }
}

async function installHiddenPanelProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const animationNames = new Set<string>();
    const probe: HiddenPanelProbe = {
      samples: 0,
      maxOpacity: 0,
      animationNames: [],
    };
    window.__hiddenPanelProbe = probe;

    const sample = () => {
      for (const panel of document.querySelectorAll<HTMLElement>(
        ".ui-floating-panel[data-anchor-hidden]",
      )) {
        const style = getComputedStyle(panel);
        probe.samples += 1;
        probe.maxOpacity = Math.max(probe.maxOpacity, Number(style.opacity));
        animationNames.add(style.animationName);
        probe.animationNames = [...animationNames];
      }
      requestAnimationFrame(sample);
    };

    window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(sample), {
      once: true,
    });
  });
}

const scenarios = [
  {
    route: "/ui/components/select",
    heading: "Select",
    minimumSamples: 1,
    viewportHeight: 1000,
  },
  {
    route: "/ui/components/tooltip",
    heading: "Tooltip",
    minimumSamples: 3,
    viewportHeight: 400,
  },
] as const;

for (const { route, heading, minimumSamples, viewportHeight } of scenarios) {
  test(`never paints initially open off-screen panels on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: viewportHeight });
    await installHiddenPanelProbe(page);

    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect
      .poll(async () => await page.evaluate(() => window.__hiddenPanelProbe?.samples ?? 0))
      .toBeGreaterThanOrEqual(minimumSamples);

    const probe = await page.evaluate(() => window.__hiddenPanelProbe);
    expect(probe).toBeDefined();
    expect(probe?.maxOpacity).toBe(0);
    expect(probe?.animationNames).toEqual(["none"]);
  });
}
