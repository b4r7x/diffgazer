// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HookSourceData } from "@/lib/generated-doc-data";
import { loadDocPageData } from "@/lib/load-doc-data";
import type { ComponentSourceData } from "@/types/data";
import { CopyButton } from "../copy-button";
import { SourceViewerBlock } from "./blocks/source-viewer";
import { DocDataProvider } from "./doc-data-context";
import { SourceViewer, type SourceViewerContent } from "./source-viewer";

const currentLibrary = vi.hoisted(() => ({ value: "ui" as "keys" | "ui" }));

vi.mock("./blocks/use-current-library", () => ({
  useCurrentLibrary: () => currentLibrary.value,
}));

const files = [
  {
    path: "registry/ui/button/button.tsx",
    raw: "export function Button() {}",
    highlighted: [{ number: 1, content: [{ text: "export function Button() {}" }] }],
  },
];

const multipleFiles = [
  ...files,
  {
    path: "registry/ui/button/button.css",
    raw: ".button {}",
    highlighted: [{ number: 1, content: [{ text: ".button {}" }] }],
  },
];

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
  currentLibrary.value = "ui";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SourceViewer", () => {
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

  it("renders and copies all six public use-navigation files", async () => {
    currentLibrary.value = "keys";
    const user = userEvent.setup();
    const pageData = await loadDocPageData("keys", "hooks", "use-navigation", {
      throwIfMissing: true,
    });
    if (!pageData) throw new Error("use-navigation docs data is missing");

    const expectedPaths = [
      "src/hooks/use-navigation.ts",
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
          "../../../public/source-data/keys/hooks/use-navigation.source.json",
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

    await user.click(screen.getByRole("button", { name: "View hook source (6 files)" }));

    expect(fetchMock).toHaveBeenCalledWith("/source-data/keys/hooks/use-navigation.source.json");
    for (const path of paths) {
      expect(await screen.findByText(path)).toBeInTheDocument();
    }

    await user.click(screen.getByText("[Copy useNavigation]"));
    const copiedArchive = archiveFiles.map((file) => `// ${file.path}\n${file.raw}`).join("\n\n");
    expect(writeText).toHaveBeenCalledWith(copiedArchive);
  });

  it("loads, caches, and mounts source only while the disclosure is open", async () => {
    const user = userEvent.setup();
    let resolveSource: ((content: SourceViewerContent) => void) | undefined;
    const loadSource = vi.fn(
      () =>
        new Promise<SourceViewerContent>((resolve) => {
          resolveSource = resolve;
        }),
    );
    render(
      <SourceViewer cacheKey="ui:component:button:lazy" fileCount={1} loadSource={loadSource} />,
    );

    expect(screen.queryByText("LAZY_SOURCE_MARKER")).toBeNull();
    await user.click(screen.getByRole("button", { name: /View component source/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading source...");

    await act(async () => {
      resolveSource?.({
        files: [
          {
            path: "button.tsx",
            raw: "LAZY_SOURCE_MARKER",
            highlighted: [{ number: 1, content: [{ text: "LAZY_SOURCE_MARKER" }] }],
          },
        ],
      });
    });
    expect(await screen.findByText("LAZY_SOURCE_MARKER")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View component source/i }));
    expect(screen.queryByText("LAZY_SOURCE_MARKER")).toBeNull();

    await user.click(screen.getByRole("button", { name: /View component source/i }));
    expect(await screen.findByText("LAZY_SOURCE_MARKER")).toBeInTheDocument();
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent source requests for the same route", async () => {
    let resolveSource: ((content: SourceViewerContent) => void) | undefined;
    const loadSource = vi.fn(
      () =>
        new Promise<SourceViewerContent>((resolve) => {
          resolveSource = resolve;
        }),
    );
    render(
      <>
        <SourceViewer cacheKey="ui:component:button:coalesced" loadSource={loadSource} />
        <SourceViewer cacheKey="ui:component:button:coalesced" loadSource={loadSource} />
      </>,
    );

    const triggers = screen.getAllByRole("button", { name: /View component source/i });
    // fireEvent retained: both disclosures must open synchronously before the deferred source
    // request resolves to prove coalescing; userEvent would serialize and await the interactions.
    for (const trigger of triggers) fireEvent.click(trigger);
    expect(loadSource).toHaveBeenCalledTimes(1);

    await act(async () => resolveSource?.({ files }));
    expect(await screen.findAllByText("export function Button() {}")).toHaveLength(2);
  });

  it("refreshes recent source and evicts the least recently used entry at capacity", async () => {
    const user = userEvent.setup();
    const loadCounts = new Map<number, number>();
    const totalLoads = () =>
      Array.from(loadCounts.values()).reduce((total, count) => total + count, 0);
    const openSource = async (index: number) => {
      const marker = `LRU_SOURCE_${String(index)}`;
      const view = render(
        <SourceViewer
          cacheKey={`ui:component:lru-cache-${String(index)}`}
          loadSource={async () => {
            loadCounts.set(index, (loadCounts.get(index) ?? 0) + 1);
            return {
              files: [
                {
                  path: `source-${String(index)}.tsx`,
                  raw: marker,
                  highlighted: [{ number: 1, content: [{ text: marker }] }],
                },
              ],
            };
          }}
        />,
      );
      await user.click(screen.getByRole("button", { name: /View component source/i }));
      await screen.findByText(marker);
      view.unmount();
    };

    for (let index = 0; index < 8; index += 1) await openSource(index);
    expect(totalLoads()).toBe(8);

    await openSource(0);
    expect(totalLoads()).toBe(8);

    await openSource(8);
    expect(totalLoads()).toBe(9);

    await openSource(1);
    expect(loadCounts.get(1)).toBe(2);

    await openSource(0);
    expect(loadCounts.get(0)).toBe(1);
    expect(totalLoads()).toBe(10);
  });

  it("shows a recoverable error when on-demand source loading fails", async () => {
    const user = userEvent.setup();
    const loadSource = vi
      .fn<() => Promise<SourceViewerContent>>()
      .mockRejectedValueOnce(new Error("source unavailable"))
      .mockResolvedValueOnce({ files });
    render(
      <SourceViewer cacheKey="ui:component:button:retry" fileCount={1} loadSource={loadSource} />,
    );

    await user.click(screen.getByRole("button", { name: /View component source/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Source could not be loaded.");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("export function Button() {}")).toBeInTheDocument();
    expect(loadSource).toHaveBeenCalledTimes(2);
  });

  it("does not synthesize a public installer command when no installer is configured", () => {
    render(<SourceViewer files={files} />);

    expect(screen.queryByText(/Install via CLI/i)).toBeNull();
    expect(screen.queryByText(/npx @diffgazer\/add/i)).toBeNull();
    expect(screen.getByRole("button", { name: /View component source/i })).toBeInTheDocument();
  });

  it("shows the configured install command", () => {
    render(<SourceViewer files={files} installCommand="pnpm exec dgadd add ui/button" />);

    expect(screen.getByText("pnpm exec dgadd add ui/button")).toBeInTheDocument();
  });

  it("announces the file count when multiple files are present", () => {
    render(<SourceViewer files={multipleFiles} />);

    expect(
      screen.getByRole("button", {
        name: /View component source \(2 files\)/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders consumer-provided integration guidance alongside the install command", () => {
    render(
      <SourceViewer
        files={files}
        installCommand="pnpm exec dgadd add ui/button"
        integrationNote={<span>Use --integration keys for the full experience.</span>}
      />,
    );

    expect(
      screen.getByText(/Use --integration keys for the full experience\./i),
    ).toBeInTheDocument();
  });

  it("renders a consumer-provided copy button in the Source heading", () => {
    const { rerender } = render(<SourceViewer files={files} />);

    expect(screen.queryByText("[Copy Full Source]")).toBeNull();

    rerender(
      <SourceViewer
        files={files}
        copyButton={<CopyButton text="export function Button() {}" label="Copy Full Source" />}
      />,
    );

    expect(screen.getByText("[Copy Full Source]")).toBeInTheDocument();
  });

  it("renders nothing when there are no files", () => {
    const { container } = render(<SourceViewer files={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("exposes the Source heading with an id for the page ToC", () => {
    render(<SourceViewer files={files} />);

    expect(screen.getByRole("heading", { level: 2, name: "Source" })).toHaveAttribute(
      "id",
      "source",
    );
  });

  it("exposes the source accordion trigger with heading semantics", () => {
    render(<SourceViewer files={files} />);

    expect(screen.getByRole("heading", { name: /View component source/i })).toBeInTheDocument();
  });
});
