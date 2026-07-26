import { expect, test } from "@playwright/test";

test.describe("Sidebar iframe viewport ownership", () => {
  test("subscribes, rechecks, and cleans up against the frame window", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto("/ui/components/sidebar");

    const iframe = page.locator('iframe[title="Sidebar owner window"]');
    await expect(iframe).toBeVisible();
    await iframe.evaluate((element) => {
      const view = (element as HTMLIFrameElement).contentWindow;
      if (!view) throw new Error("Expected sidebar fixture contentWindow");
      const nativeMatchMedia = view.matchMedia.bind(view);
      const activeListeners = new Set<EventListenerOrEventListenerObject>();
      const stats = { added: 0, removed: 0, active: 0, calls: 0 };
      Reflect.set(view, "__sidebarMqlStats", stats);
      view.matchMedia = (query: string) => {
        stats.calls += 1;
        const nativeQuery = nativeMatchMedia(query);
        return {
          get matches() {
            return nativeQuery.matches;
          },
          media: nativeQuery.media,
          onchange: null,
          addListener: (listener: Parameters<MediaQueryList["addListener"]>[0]) =>
            nativeQuery.addListener(listener),
          removeListener: (listener: Parameters<MediaQueryList["removeListener"]>[0]) =>
            nativeQuery.removeListener(listener),
          addEventListener: (...args: Parameters<MediaQueryList["addEventListener"]>) => {
            const [type, listener] = args;
            if (type === "change") {
              stats.added += 1;
              activeListeners.add(listener);
              stats.active = activeListeners.size;
            }
            nativeQuery.addEventListener(...args);
          },
          removeEventListener: (...args: Parameters<MediaQueryList["removeEventListener"]>) => {
            const [type, listener] = args;
            if (type === "change") {
              stats.removed += 1;
              activeListeners.delete(listener);
              stats.active = activeListeners.size;
            }
            nativeQuery.removeEventListener(...args);
          },
          dispatchEvent: (event) => nativeQuery.dispatchEvent(event),
        };
      };
    });

    // The at-rest sidebar subscribed before the shim above existed, so its
    // listener lives on the native matchMedia and is invisible to the stats.
    // One remount recreates the subscription through the patched window.
    await page.getByRole("button", { name: "Unmount frame sidebar", exact: true }).click();
    await page.getByRole("button", { name: "Mount frame sidebar", exact: true }).click();

    const frame = page.frameLocator('iframe[title="Sidebar owner window"]');
    const navigation = frame.getByRole("navigation", { name: "Frame navigation" });
    const dialog = frame.getByRole("dialog", { name: "Frame navigation" });
    const frameTrigger = frame.getByRole("button", { name: "Open navigation" });

    // The sidebar is mounted at rest, and the 420px frame is below breakpoint
    // 600, so the nav lives in a sheet that starts closed: only the trigger is
    // on the page until it is tapped.
    await expect(frameTrigger).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(navigation).toHaveCount(0);

    await frameTrigger.click();
    await expect(dialog).toBeVisible();
    await expect(navigation).toHaveAttribute("data-mobile", "true");
    await expect
      .poll(() =>
        iframe.evaluate((element) => {
          const view = (element as HTMLIFrameElement).contentWindow;
          return Reflect.get(view ?? {}, "__sidebarMqlStats") as {
            active: number;
            calls: number;
          };
        }),
      )
      .toMatchObject({ active: 1, calls: 1 });

    await iframe.evaluate((element) => {
      element.setAttribute("style", "width: 900px");
    });
    await expect(dialog).toHaveCount(0);
    await expect(navigation).not.toHaveAttribute("data-mobile", "true");

    await page.setViewportSize({ width: 500, height: 900 });
    await expect(navigation).not.toHaveAttribute("data-mobile", "true");

    await iframe.evaluate((element) => {
      element.setAttribute("style", "width: 420px");
    });
    // Crossing back below the breakpoint resets the sheet's own open state, so
    // the sheet must stay closed until it is reopened deliberately.
    await expect(dialog).toHaveCount(0);
    await frameTrigger.click();
    await expect(dialog).toBeVisible();
    await expect(navigation).toHaveAttribute("data-mobile", "true");

    await dialog.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.getByRole("button", { name: "Unmount frame sidebar", exact: true }).click();
    await expect(navigation).toHaveCount(0);
    await expect(frameTrigger).toHaveCount(0);
    await expect
      .poll(() =>
        iframe.evaluate((element) => {
          const view = (element as HTMLIFrameElement).contentWindow;
          return Reflect.get(view ?? {}, "__sidebarMqlStats") as {
            active: number;
            removed: number;
          };
        }),
      )
      .toMatchObject({ active: 0, removed: 1 });

    // Remounting re-subscribes against the frame window, which is the half of
    // the lifecycle the unmount assertions above cannot prove on their own.
    await page.getByRole("button", { name: "Mount frame sidebar", exact: true }).click();
    await expect(frameTrigger).toBeVisible();
    await expect
      .poll(() =>
        iframe.evaluate((element) => {
          const view = (element as HTMLIFrameElement).contentWindow;
          return Reflect.get(view ?? {}, "__sidebarMqlStats") as {
            active: number;
            removed: number;
          };
        }),
      )
      .toMatchObject({ active: 1, removed: 1 });
  });
});
