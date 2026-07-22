// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HookSourceData } from "@/lib/generated-doc-data";
import { loadDocPageData } from "@/lib/load-doc-data";
import type { ComponentSourceData } from "@/types/data";
import { DocDataProvider } from "../doc-data-context";
import { SourceViewerBlock } from "./source-viewer";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/select",
}));

vi.mock("@tanstack/react-router", async () => {
  const { useLocationMock } = await import("@/testing/router-mock");
  return useLocationMock({
    get pathname() {
      return routerBoundary.pathname;
    },
  });
});

const staticSourceData = {
  source: {
    "@ui/select/select.tsx": {
      raw: "RAW_SELECT_SOURCE_MARKER",
      highlighted: [{ number: 1, content: [{ text: "HIGHLIGHTED_SELECT_SOURCE_MARKER" }] }],
    },
    "@ui/select/select-utils.ts": {
      raw: "RAW_SELECT_UTILS_MARKER",
      highlighted: [{ number: 1, content: [{ text: "HIGHLIGHTED_SELECT_UTILS_MARKER" }] }],
    },
  },
  mergedSource: "MERGED_SELECT_SOURCE_MARKER",
} satisfies ComponentSourceData;

function responseWithJson(data: unknown): Response {
  const response = new Response();
  vi.spyOn(response, "json").mockResolvedValue(data);
  return response;
}

afterEach(() => {
  routerBoundary.pathname = "/ui/components/select";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SourceViewerBlock", () => {
  it("keeps the static component archive out of the initial server render", async () => {
    const pageData = await loadDocPageData("ui", "components", "select", {
      throwIfMissing: true,
    });
    if (!pageData) throw new Error("Select docs data is missing");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseWithJson(staticSourceData));
    vi.stubGlobal("fetch", fetchMock);

    const html = renderToStaticMarkup(
      <DocDataProvider value={{ type: "component", data: pageData }}>
        <SourceViewerBlock />
      </DocDataProvider>,
    );

    expect(pageData).not.toHaveProperty("source");
    expect(html).not.toContain("HIGHLIGHTED_SELECT_SOURCE_MARKER");
    expect(html).not.toContain("MERGED_SELECT_SOURCE_MARKER");
    expect(html).toContain("Browse the source repository");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the static archive only after opening and preserves paths, highlighting, and copy", async () => {
    const user = userEvent.setup();
    const pageData = await loadDocPageData("ui", "components", "select", {
      throwIfMissing: true,
    });
    if (!pageData) throw new Error("Select docs data is missing");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseWithJson(staticSourceData));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocDataProvider value={{ type: "component", data: pageData }}>
        <SourceViewerBlock />
      </DocDataProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /View component source/i }));

    expect(fetchMock).toHaveBeenCalledWith("/source-data/ui/components/select.source.json");
    expect(await screen.findByText("HIGHLIGHTED_SELECT_SOURCE_MARKER")).toBeInTheDocument();
    expect(screen.getByText("HIGHLIGHTED_SELECT_UTILS_MARKER")).toBeInTheDocument();
    expect(screen.getByText("@ui/select/select.tsx")).toBeInTheDocument();
    expect(screen.getByText("@ui/select/select-utils.ts")).toBeInTheDocument();
    expect(screen.getByText("[Copy Full Source]")).toBeInTheDocument();
  });

  it("renders and copies all seven public use-navigation files", async () => {
    routerBoundary.pathname = "/keys/hooks/use-navigation";
    const user = userEvent.setup();
    const pageData = await loadDocPageData("keys", "hooks", "use-navigation", {
      throwIfMissing: true,
    });
    if (!pageData) throw new Error("use-navigation docs data is missing");

    const expectedPaths = [
      "src/hooks/use-navigation.ts",
      "src/hooks/utils/navigation-core.ts",
      "src/hooks/utils/navigation-dispatch.ts",
      "src/hooks/utils/navigation-items.ts",
      "src/hooks/utils/navigation-directions.ts",
      "src/hooks/utils/focusable.ts",
      "src/hooks/utils/element-guards.ts",
    ];
    const archive = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../../public/source-data/keys/hooks/use-navigation.source.json",
        ),
        "utf8",
      ),
    ) as HookSourceData;
    const archiveFiles = archive.files ?? [];
    const paths = archiveFiles.map((file) => file.path);
    expect(pageData.files).toEqual(expectedPaths);
    expect(paths).toEqual(expectedPaths);

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseWithJson(archive));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("isSecureContext", true);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    render(
      <DocDataProvider value={{ type: "hook", data: pageData }}>
        <SourceViewerBlock />
      </DocDataProvider>,
    );

    await user.click(screen.getByRole("button", { name: "View hook source (7 files)" }));

    expect(fetchMock).toHaveBeenCalledWith("/source-data/keys/hooks/use-navigation.source.json");
    for (const path of paths) {
      expect(await screen.findByText(path)).toBeInTheDocument();
    }

    await user.click(screen.getByText("[Copy useNavigation]"));
    const copiedArchive = archiveFiles.map((file) => `// ${file.path}\n${file.raw}`).join("\n\n");
    expect(writeText).toHaveBeenCalledWith(copiedArchive);
  });
});
