import "../testing/terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { terminalCellWidth } from "../../../lib/terminal-width";
import {
  ARROW_DOWN,
  catalogModelsResponse,
  flush,
  flushUntil,
  geminiName,
  skippedCatalogModelsResponse,
  Wrapper,
} from "../testing/model-select-overlay";
import { ModelSelectOverlay } from "./model-select-overlay";

const ARROW_RIGHT = "\u001b[C";

const CATALOG_EMPTY_MODELS_REASON =
  "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.";

describe("ModelSelectOverlay discovery provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the skipped catalog reason, checkedAt, and retry control", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        skippedCatalogModelsResponse(GEMINI_CONFIGURATION, CATALOG_EMPTY_MODELS_REASON),
      );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("no model this product") ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Google Gemini");
    expect(frame).toContain("checked");
    expect(frame).toContain("[ Retry ]");
    expect(frame).not.toContain("structured outputs");
  });

  test("retries discovery with r after a rejected query", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("Model discovery failed. Test the configuration again."))
      .mockResolvedValueOnce(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
  });

  test("renders the catalog candidate models without admission claims", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("gemini-2.5-flash");
    expect(frame).toContain("1 model");
    expect(frame).not.toContain("Using cached catalog data");
    expect(getConfigurationModels).toHaveBeenCalledWith("gemini-primary", expect.any(AbortSignal));
  });

  // The snapshot tier's fetchedAt is stamped at read time, so a checked date
  // over bundled data would be fabricated; the label names the data instead.
  test("labels the bundled snapshot tier instead of claiming a checked date", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("bundled catalog");
    expect(frame).not.toContain("checked");
  });

  test("keeps the checked date for a live provider list", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION, undefined, "provider-live"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("checked");
    expect(frame).not.toContain("bundled catalog");
  });
});

describe("ModelSelectOverlay retained selection", () => {
  afterEach(() => {
    cleanup();
  });

  // A configuration saved before the capability filter existed keeps working;
  // the overlay says so instead of leaving the missing row unexplained.
  test("explains a saved model the review-capable list no longer offers", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          selectedId="retired-model-id"
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("stays configured") ?? false);
    expect(lastFrame() ?? "").toContain("retired-model-id");
  });

  test("says nothing about the saved model while it is still offered", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          selectedId="gemini-2.5-flash"
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(lastFrame() ?? "").not.toContain("stays configured");
  });
});

// Discovery puts the union of both pools on the wire and the tabs divide it: a
// Go-only row is one tab away, never excluded with a note about where it lives.
const ZEN_MODELS: ModelInfo[] = [
  {
    id: "deepseek-v4-flash",
    name: "deepseek-v4-flash",
    description: "shared route",
    tier: "paid",
    endpointProfileIds: ["zen", "go"],
  },
  {
    id: "zen-only-model",
    name: "zen-only-model",
    description: "zen route",
    tier: "paid",
    endpointProfileIds: ["zen"],
  },
  {
    id: "go-only-model",
    name: "go-only-model",
    description: "go route",
    tier: "paid",
    endpointProfileIds: ["go"],
  },
];

function makeModelsApi(response: ReturnType<typeof catalogModelsResponse>): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getConfigurationModels: vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(response),
  } satisfies BoundApi;
}

function renderZenOverlay(onSelect?: (id: string, endpoint?: string) => unknown) {
  return render(
    <Wrapper api={makeModelsApi(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, ZEN_MODELS))}>
      <ModelSelectOverlay
        open
        onOpenChange={() => {}}
        configuration={OPENCODE_ZEN_CONFIGURATION}
        onSelect={onSelect}
      />
    </Wrapper>,
  );
}

const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";

describe("ModelSelectOverlay pool filter", () => {
  afterEach(() => {
    cleanup();
  });

  test("lists only the active tab's rows without badges and counts the union in the subtitle", async () => {
    const { lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    const frame = stripAnsi(lastFrame() ?? "");
    // The bound Zen tab is active, so it lists what Zen serves: the shared row
    // and the Zen-only one. The Go-only row is a tab away.
    expect(frame).toContain("deepseek-v4-flash");
    expect(frame).toContain("zen-only-model");
    expect(frame).not.toContain("go-only-model");
    // The tab names the wallet, so no row repeats it as a badge.
    expect(frame).not.toContain("[Zen]");
    expect(frame).not.toContain("[Go]");
    // A row is filtered onto its own tab, never explained away.
    expect(frame).not.toContain("only available on");
    expect(frame).not.toContain("Also on");
    // The subtitle counts the union the tabs divide, not the visible rows.
    expect(frame).toContain("OpenCode · 3 models");
  });

  test("p switches the tab: the row set changes and the billing note follows", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Saving moves billing");

    stdin.write("p");
    await flush();

    const goFrame = stripAnsi(lastFrame() ?? "");
    expect(goFrame).toContain("deepseek-v4-flash");
    expect(goFrame).toContain("go-only-model");
    expect(goFrame).not.toContain("zen-only-model");
    // Every row this tab lists bills Go, so the note states the move once.
    expect(goFrame).toContain("Saving moves billing to OpenCode Go.");

    stdin.write("p");
    await flush();
    const zenFrame = stripAnsi(lastFrame() ?? "");
    expect(zenFrame).toContain("zen-only-model");
    expect(zenFrame).not.toContain("go-only-model");
    expect(zenFrame).not.toContain("Saving moves billing");
  });

  test("arrowing down from search lands on the pool tabs, then on the tier tabs", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    stdin.write("/");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    // The pool zone owns the arrows: they switch the tab and the list follows.
    expect(stripAnsi(lastFrame() ?? "")).toContain("go-only-model");
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("zen-only-model");

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    // The tier zone now owns the arrows, and the Go tab stayed put.
    expect(stripAnsi(lastFrame() ?? "")).toContain("· FREE");
    expect(stripAnsi(lastFrame() ?? "")).toContain("· Go");

    // Back to ALL: the tier arrows never touched the tab's rows.
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("· ALL");
    expect(frame).toContain("go-only-model");
    expect(frame).not.toContain("zen-only-model");
  });

  test("posts the Go endpoint for a shared row confirmed on the Go tab", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = renderZenOverlay(onSelect);

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    stdin.write("p");
    await flush();
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4-flash", GO_ENDPOINT);
  });

  test("lists a zen-only row only under the Zen tab and posts no endpoint", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = renderZenOverlay(onSelect);

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    stdin.write("p");
    await flush();
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("zen-only-model");

    stdin.write("p");
    await flush();
    stdin.write("j");
    await flush();
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);
    // A Zen row bills Zen, the bound pool, so the save carries no endpoint.
    expect(onSelect).toHaveBeenCalledWith("zen-only-model", undefined);
  });

  test("holds the billing note and the merged filter row inside an 80x24 terminal", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    stdin.write("p");
    await flush();

    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    expect(lines.every((line) => terminalCellWidth(line) <= 80)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(24);
    const frame = stripAnsi(lastFrame() ?? "");
    // The whole stack fits: search, both filter groups on one row, the note, and
    // a list window wide enough for every row the tab lists.
    expect(frame).toContain("Search models...");
    expect(frame).toContain("· Go");
    expect(frame).toContain("· ALL");
    expect(frame).toContain("Saving moves billing to OpenCode Go.");
    expect(frame).toContain("deepseek-v4-flash");
    expect(frame).toContain("go-only-model");
  });

  test("holds the list window steady across a pool tab switch", async () => {
    // Both pools serve every row, so the tab switch changes nothing but the
    // note. Its rows are reserved whatever the tab, so the appearing note must
    // not resize the viewport and slide the rows under the cursor.
    const manyModels: ModelInfo[] = Array.from({ length: 20 }, (_, index) => ({
      id: `model-${String(index).padStart(2, "0")}`,
      name: `model-${String(index).padStart(2, "0")}`,
      description: "",
      tier: "paid" as const,
      endpointProfileIds: ["zen", "go"],
    }));
    const { stdin, lastFrame } = render(
      <Wrapper api={makeModelsApi(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, manyModels))}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={OPENCODE_ZEN_CONFIGURATION}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("model-00") ?? false);
    const visibleIds = () => {
      const frame = stripAnsi(lastFrame() ?? "");
      return manyModels.map(({ id }) => id).filter((id) => frame.includes(id));
    };
    const before = visibleIds();
    expect(before.length).toBeGreaterThan(1);
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Saving moves billing");

    stdin.write("p");
    await flush();

    // The note is now showing, and the same rows are still on screen.
    expect(stripAnsi(lastFrame() ?? "")).toContain("Saving moves billing to OpenCode Go.");
    expect(visibleIds()).toEqual(before);
  });

  test("leaves a single-endpoint product unbadged and without a pool row", async () => {
    const { lastFrame } = render(
      <Wrapper api={makeModelsApi(catalogModelsResponse(GEMINI_CONFIGURATION))}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Google Gemini · 1 model · bundled catalog");
    // No half of the pool UI reaches a single-endpoint product: the header row
    // carries the tier group alone, which never prints the labels "Zen" / "Go".
    expect(frame).not.toMatch(/\bZen\b/);
    expect(frame).not.toMatch(/\bGo\b/);
  });

  test("lists an unknown-membership row under both tabs without a badge", async () => {
    const unknownMembership: ModelInfo[] = [
      { id: "unlabeled-model", name: "unlabeled-model", description: "", tier: "paid" },
    ];
    const { stdin, lastFrame } = render(
      <Wrapper
        api={makeModelsApi(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, unknownMembership))}
      >
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={OPENCODE_ZEN_CONFIGURATION}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("unlabeled-model") ?? false);
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("[Zen]");

    stdin.write("p");
    await flush();
    const frame = stripAnsi(lastFrame() ?? "");
    // No membership on the wire means no tab may hide it.
    expect(frame).toContain("unlabeled-model");
    expect(frame).not.toContain("[Go]");
  });

  test("notices a saved model the active tab does not serve", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper api={makeModelsApi(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, ZEN_MODELS))}>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          configuration={OPENCODE_ZEN_CONFIGURATION}
          selectedId="zen-only-model"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    stdin.write("p");
    await flush();

    // The saved row leaves the Go tab's list; the notice names the tab that
    // still serves it instead of hiding the gap.
    const goLines = stripAnsi(lastFrame() ?? "")
      .split("\n")
      .filter((line) => line.includes("zen-only-model"));
    expect(goLines).toEqual([expect.stringContaining("zen-only-model is on the Zen tab.")]);

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);
    // Enter resolves among the visible rows, never the hidden saved one.
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4-flash", GO_ENDPOINT);
    // The settled save asks to close; the overlay is kept open to switch back.
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    await flush();

    stdin.write("p");
    await flushUntil(() => !stripAnsi(lastFrame() ?? "").includes("go-only-model"));
    const zenFrame = stripAnsi(lastFrame() ?? "");
    expect(zenFrame).toContain("zen-only-model");
    expect(zenFrame).not.toContain("is on the Zen tab.");
  });

  test("says no models match and lets Enter save nothing when the active tab is emptied", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = renderZenOverlay(onSelect);

    await flushUntil(() => lastFrame()?.includes("zen-only-model") ?? false);
    // Every Zen row is paid, so the FREE tier empties the active tab.
    stdin.write("f");
    await flush();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("No models match the current filters.");
    expect(frame).not.toContain("zen-only-model");

    stdin.write("\r");
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
