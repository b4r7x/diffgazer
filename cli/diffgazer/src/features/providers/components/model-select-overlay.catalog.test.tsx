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
    expect(frame).toContain("gemini");
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

// The discovery list is the union of both pools: a Go-only row is offered here
// and says so, instead of being excluded with a note about where it lives.
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

describe("ModelSelectOverlay pool selector", () => {
  afterEach(() => {
    cleanup();
  });

  test("names the pool each row will bill and explains no row away", async () => {
    const { lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    const frame = stripAnsi(lastFrame() ?? "");
    // A single-pool row bills its own pool whatever is armed; a shared row
    // follows the armed pool, which starts on the bound one.
    expect(frame).toMatch(/deepseek-v4-flash\s+\[PAID]\s+\[Zen]/);
    expect(frame).toMatch(/zen-only-model\s+\[PAID]\s+\[Zen]/);
    expect(frame).toMatch(/go-only-model\s+\[PAID]\s+\[Go]/);
    // The union lists every row, so no copy explains a row away.
    expect(frame).not.toContain("only available on");
    expect(frame).not.toContain("Also on");
    // The rows carry the pool, so the subtitle only counts the union.
    expect(frame).toContain("opencode-zen · 3 models");
  });

  test("p re-badges the shared row alone and states the wallet it moves to", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    stdin.write("p");
    await flush();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toMatch(/deepseek-v4-flash\s+\[PAID]\s+\[Go]/);
    // Selector, not filter: the same three rows in the same order.
    expect(frame).toMatch(/deepseek-v4-flash[\s\S]*zen-only-model[\s\S]*go-only-model/);
    // …and no more and no fewer of them, which the ordering regex alone cannot say.
    expect(frame).toContain("opencode-zen · 3 models");
    expect(frame).toMatch(/zen-only-model\s+\[PAID]\s+\[Zen]/);
    expect(frame).toContain("Saving moves billing to OpenCode Go.");

    stdin.write("p");
    await flush();
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/deepseek-v4-flash\s+\[PAID]\s+\[Zen]/);
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Saving moves billing");
  });

  test("arrowing down from search lands on the pool row, then on the tier row", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    stdin.write("/");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/deepseek-v4-flash\s+\[PAID]\s+\[Go]/);

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    // The tier row now owns the arrows, and the armed pool stayed put.
    expect(stripAnsi(lastFrame() ?? "")).toContain("· FREE");
    expect(stripAnsi(lastFrame() ?? "")).toContain("· Go");
  });

  test("sends the armed pool's endpoint with a row both pools serve", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = renderZenOverlay(onSelect);

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    stdin.write("p");
    await flush();
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4-flash", GO_ENDPOINT);
  });

  test("keeps a single-pool row on its own pool however the selector is armed", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = renderZenOverlay(onSelect);

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    stdin.write("p");
    await flush();
    stdin.write("j");
    await flush();
    // The note follows the highlighted row's badge, not the toggle.
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Saving moves billing");

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);
    // zen-only-model is a Zen row: the armed Go pool does not travel with it.
    expect(onSelect).toHaveBeenCalledWith("zen-only-model", undefined);
  });

  test("holds the armed-pool note and the pool row inside an 80x24 terminal", async () => {
    const { stdin, lastFrame } = renderZenOverlay();

    await flushUntil(() => lastFrame()?.includes("go-only-model") ?? false);
    stdin.write("p");
    await flush();

    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    expect(lines.every((line) => terminalCellWidth(line) <= 80)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(24);
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Saving moves billing to OpenCode Go.");
    expect(frame).toContain("go-only-model");
  });

  test("holds the list window steady as the highlight crosses a pool boundary", async () => {
    // Row 0 is Zen, every row after it is Go, and the list is longer than the
    // viewport. One arrow down makes the billing note appear; that must not
    // resize the viewport and slide the rows under a cursor that moved by one.
    const manyModels: ModelInfo[] = Array.from({ length: 20 }, (_, index) => ({
      id: `model-${String(index).padStart(2, "0")}`,
      name: `model-${String(index).padStart(2, "0")}`,
      description: "",
      tier: "paid" as const,
      endpointProfileIds: index === 0 ? ["zen"] : ["go"],
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

    stdin.write("j");
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
    expect(frame).toContain("gemini · 1 model · bundled catalog");
    // Neither half of the pool UI reaches a single-endpoint product: no per-row
    // billing badge ("[Zen]" / "[Go]") and no pool selector row, which prints
    // the bare labels "Zen" / "Go".
    expect(frame).not.toMatch(/\bZen\b/);
    expect(frame).not.toMatch(/\bGo\b/);
  });

  test("leaves a model of unknown membership on the armed pool", async () => {
    const unknownMembership: ModelInfo[] = [
      { id: "unlabeled-model", name: "unlabeled-model", description: "", tier: "paid" },
    ];
    const { lastFrame } = render(
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
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/unlabeled-model\s+\[PAID]\s+\[Zen]/);
  });
});
