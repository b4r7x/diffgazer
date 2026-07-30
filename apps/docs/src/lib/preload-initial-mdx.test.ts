// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { preloadInitialMdx } from "./preload-initial-mdx";

const preload = vi.hoisted(() => ({
  docs: vi.fn(),
  legal: vi.fn(),
}));

vi.mock("../../.source/browser", () => ({
  default: {
    docs: {
      createClientLoader: () => ({ preload: preload.docs }),
    },
    legal: {
      createClientLoader: () => ({ preload: preload.legal }),
    },
  },
}));

describe("preloadInitialMdx", () => {
  beforeEach(() => {
    preload.docs.mockReset();
    preload.legal.mockReset();
    document.body.replaceChildren();
  });

  it.each([
    { collection: "docs", path: "ui/components/select.mdx", expected: preload.docs },
    { collection: "legal", path: "privacy.mdx", expected: preload.legal },
  ])("preloads the $collection marker before hydration", async ({ collection, path, expected }) => {
    const marker = document.createElement("span");
    marker.dataset.mdxPreload = "";
    marker.dataset.mdxCollection = collection;
    marker.dataset.mdxPath = path;
    document.body.append(marker);

    await preloadInitialMdx();

    expect(expected).toHaveBeenCalledWith(path);
  });

  it("does nothing without a valid server marker", async () => {
    await preloadInitialMdx();

    expect(preload.docs).not.toHaveBeenCalled();
    expect(preload.legal).not.toHaveBeenCalled();
  });
});
