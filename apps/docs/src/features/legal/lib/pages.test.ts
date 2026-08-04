import { beforeEach, describe, expect, it, vi } from "vitest";
import { legalRouteOptions } from "./pages";

const loadLegalPage = vi.hoisted(() => vi.fn());

vi.mock("@/features/legal/lib/load-page", () => ({ loadLegalPage }));

describe("legalRouteOptions", () => {
  beforeEach(() => {
    loadLegalPage.mockReset();
  });

  it("keeps the loader pending until the MDX preload resolves", async () => {
    let resolvePreload!: () => void;
    const preloadContent = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    const data = {
      path: "privacy.mdx",
      title: "Privacy policy",
      description: "Privacy details.",
    };
    loadLegalPage.mockResolvedValue(data);

    const options = legalRouteOptions("privacy", preloadContent);
    let settled = false;
    const loading = options.loader().then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => expect(preloadContent).toHaveBeenCalledWith("privacy.mdx"));
    expect(settled).toBe(false);

    resolvePreload();
    await expect(loading).resolves.toBe(data);
  });
});
