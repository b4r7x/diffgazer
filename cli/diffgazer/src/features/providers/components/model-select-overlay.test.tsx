import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type {
  ActivateProviderResponse,
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { terminalCellWidth } from "../../../lib/terminal-width";
import { escapeRegExp } from "../../../testing/escape-regexp";
import { CliThemeProvider } from "../../../theme/provider";
import { ModelSelectOverlay } from "./model-select-overlay";

const terminalDimensions = vi.hoisted(() => ({
  current: { columns: 80, rows: 24 },
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";

afterEach(() => {
  terminalDimensions.current = { columns: 80, rows: 24 };
});

// Free-first 5-model Gemini layout (3 free, 2 paid), matching the catalog's
// deterministic free-first ordering. The transform (P1) produces this order; the
// overlay test feeds the same shape over the boundary-mocked api.
const GEMINI_CATALOG: ProviderModelsResponse = {
  models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M ctx", tier: "free" },
    {
      id: "gemini-2.5-flash-lite",
      name: "Gemini 2.5 Flash-Lite",
      description: "1M ctx",
      tier: "free",
    },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "1M ctx", tier: "free" },
    {
      id: "gemini-3-flash-preview",
      name: "Gemini 3 Flash Preview",
      description: "1M ctx",
      tier: "paid",
    },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
      description: "1M ctx",
      tier: "paid",
    },
  ],
  fetchedAt: new Date().toISOString(),
  source: "live",
  cached: false,
};

function geminiName(id: string): string {
  const model = GEMINI_CATALOG.models.find((m) => m.id === id);
  if (!model) throw new Error(`Gemini catalog fixture is missing model "${id}"`);
  return model.name ?? id;
}

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Poll on a macrotask boundary. React Query resolves the mocked api over a
// microtask chain whose React-scheduler commit can land a few macrotasks later,
// and a mounted ink Spinner runs a real setInterval; yielding to setTimeout(0)
// each attempt lets both settle deterministically instead of racing setImmediate.
async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function makeGeminiApi(): BoundApi {
  const getProviderModels = vi
    .fn<() => Promise<ProviderModelsResponse>>()
    .mockResolvedValue(GEMINI_CATALOG);
  return { ...createApi({ baseUrl: "http://localhost" }), getProviderModels } satisfies BoundApi;
}

function getLargeModelName(index: number): string {
  return `Large Model ${String(index).padStart(2, "0")}`;
}

function makeLargeCatalog(count = 60): ProviderModelsResponse {
  return {
    models: Array.from({ length: count }, (_, index) => ({
      id: `large-model-${String(index).padStart(2, "0")}`,
      name: getLargeModelName(index),
      description: `Context window ${index}`,
      tier: index % 2 === 0 ? "free" : "paid",
    })),
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
}

function countRenderedModels(frame: string | undefined, catalog: ProviderModelsResponse): number {
  const text = frame ?? "";
  return catalog.models.filter((model) => text.includes(model.name)).length;
}

function countOverflowIndicators(frame: string | undefined): number {
  const text = frame ?? "";
  return Number(text.includes("\u25B2")) + Number(text.includes("\u25BC"));
}

function Wrapper({ children, api }: { children: ReactNode; api?: BoundApi }) {
  const queryClient = makeQueryClient();
  const boundApi = api ?? makeGeminiApi();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>{children}</TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function StableWrapper({
  children,
  api,
  queryClient,
}: {
  children: ReactNode;
  api: BoundApi;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>{children}</TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function countPrefixes(
  frame: string | undefined,
  name: string,
): {
  highlighted: number;
  unhighlighted: number;
} {
  if (!frame) return { highlighted: 0, unhighlighted: 0 };
  const escaped = escapeRegExp(name);
  const highlightedMatches = frame.match(new RegExp(`>\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  const unhighlightedMatches =
    frame.match(new RegExp(`(?<!>)\\s\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  return {
    highlighted: highlightedMatches.length,
    unhighlighted: unhighlightedMatches.length,
  };
}

describe("ModelSelectOverlay ArrowUp after the tier filter shrinks the list", () => {
  afterEach(() => {
    cleanup();
  });

  test("after the filter shrinks the list, ArrowUp from the clamped last item moves the highlight one item back instead of sticking on the last item", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-3-flash-preview")) ?? false);

    const initialFrame = lastFrame();
    expect(
      initialFrame?.includes(geminiName("gemini-3-flash-preview")),
      "initial frame should list gemini models",
    ).toBeTruthy();

    // Move highlight to the LAST item in the full (5-item) list.
    for (let i = 0; i < 4; i += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const lastModelName = geminiName("gemini-3-pro-preview");
    const afterDown = countPrefixes(lastFrame(), lastModelName);
    expect(
      afterDown.highlighted,
      `after 4 ArrowDown presses, the last gemini model should be highlighted. Frame: ${lastFrame()}`,
    ).toBe(1);

    // Shrink the filter to "paid" : 2 of the 5 models. With this free-first data:
    //   free: 2.5-flash, 2.5-flash-lite, 2.5-pro
    //   paid: 3-flash-preview, 3-pro-preview
    // "f" cycles all -> free -> paid, so two presses land on "paid".
    stdin.write("f");
    await flush();
    stdin.write("f");
    await flush();

    // Sanity: only the 2 paid models are visible now.
    const paidFirst = geminiName("gemini-3-flash-preview");
    const paidSecond = geminiName("gemini-3-pro-preview");
    const freeAny = geminiName("gemini-2.5-flash");
    const shrunkenFrame = lastFrame();
    expect(
      shrunkenFrame?.includes(paidFirst) && shrunkenFrame?.includes(paidSecond),
      "after switching tier filter to 'paid', both paid models should be visible",
    ).toBeTruthy();
    expect(
      !shrunkenFrame?.includes(freeAny),
      "after switching tier filter to 'paid', free models should not be visible",
    ).toBeTruthy();

    // The highlight had moved past the shrunken list, so it lands clamped on
    // the last visible (second paid) model.
    const beforeArrowUp = countPrefixes(lastFrame(), paidSecond);
    expect(
      beforeArrowUp.highlighted,
      "before ArrowUp, the last visible paid model should be highlighted",
    ).toBe(1);

    // ArrowUp must step back one item rather than staying on the last item.
    stdin.write(ARROW_UP);
    await flush();

    const afterArrowUpFirst = countPrefixes(lastFrame(), paidFirst);
    const afterArrowUpSecond = countPrefixes(lastFrame(), paidSecond);

    expect(
      afterArrowUpFirst.highlighted,
      `after ArrowUp, the first paid model should be highlighted. Frame: ${lastFrame()}`,
    ).toBe(1);
    expect(
      afterArrowUpSecond.highlighted,
      "after ArrowUp, the second paid model should no longer be highlighted",
    ).toBe(0);
  });
});

const OPENROUTER_MODELS: OpenRouterModelsResponse = {
  models: [
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      description: "Flagship",
      contextLength: 128000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0", completion: "0" },
      isFree: false,
    },
    {
      id: "anthropic/claude-3.5",
      name: "Claude 3.5",
      description: "Anthropic",
      contextLength: 200000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0", completion: "0" },
      isFree: false,
    },
  ],
  fetchedAt: new Date().toISOString(),
  cached: false,
};

describe("ModelSelectOverlay selection (Enter -> activate -> close)", () => {
  afterEach(() => {
    cleanup();
  });

  test("activates the highlighted model on Enter, then calls onSelect with its id and closes after the activate mutation resolves", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-flash" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    // The first model is highlighted by default; confirm Enter on it.
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-flash");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModelSelectOverlay saving state", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the Saving spinner and freezes the highlight while the activate mutation is pending", async () => {
    const deferred = createDeferred<ActivateProviderResponse>();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockReturnValue(deferred.promise);
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    const firstName = geminiName("gemini-2.5-flash");
    expect(countPrefixes(lastFrame(), firstName).highlighted).toBe(1);

    // Begin activation; the mutation never settles, so the overlay stays in the saving state.
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);

    expect(lastFrame()).toContain("Saving");

    // Arrow keys must be inert while saving: the highlight stays on the first model.
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    expect(
      countPrefixes(lastFrame(), firstName).highlighted,
      `highlight should stay on the first model while saving. Frame: ${lastFrame()}`,
    ).toBe(1);
    const secondName = geminiName("gemini-2.5-flash-lite");
    expect(countPrefixes(lastFrame(), secondName).highlighted).toBe(0);
  });

  test("ignores Escape while model activation is pending", async () => {
    const deferred = createDeferred<ActivateProviderResponse>();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockReturnValue(deferred.promise);
    const onOpenChange = vi.fn();
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Saving") ?? false);
    stdin.write("\u001B");
    await flush();

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Saving");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("keeps the failed row visible and navigable, then clears the error on retry", async () => {
    const onSelect = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockRejectedValueOnce(new Error("Activation failed: missing credentials"))
      .mockResolvedValueOnce({ provider: "gemini", model: "gemini-2.5-flash-lite" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Activation failed") ?? false);

    expect(lastFrame()).toContain("Activation failed: missing credentials");
    expect(lastFrame()).toContain(geminiName("gemini-2.5-flash"));
    expect(countPrefixes(lastFrame(), geminiName("gemini-2.5-flash")).highlighted).toBe(1);

    stdin.write(ARROW_DOWN);
    await flushUntil(
      () => countPrefixes(lastFrame(), geminiName("gemini-2.5-flash-lite")).highlighted === 1,
    );
    expect(lastFrame()).toContain("Activation failed: missing credentials");

    stdin.write("\r");
    await flushUntil(() => activateProvider.mock.calls.length === 2);
    await flushUntil(() => onSelect.mock.calls.length === 1);

    expect(activateProvider).toHaveBeenLastCalledWith("gemini", "gemini-2.5-flash-lite");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash-lite");
    expect(lastFrame()).not.toContain("Activation failed: missing credentials");
  });

  test("clears activation errors when the provider changes while open", async () => {
    const queryClient = makeQueryClient();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockRejectedValue(new Error("Activation failed: missing credentials"));
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const view = render(
      <StableWrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </StableWrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    view.stdin.write("\r");
    await flushUntil(() => view.lastFrame()?.includes("Activation failed") ?? false);

    view.rerender(
      <StableWrapper api={api} queryClient={queryClient}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="groq"
          onSelect={() => {}}
        />
      </StableWrapper>,
    );
    await flush();

    expect(view.lastFrame()).not.toContain("Activation failed");
  });
});

describe("ModelSelectOverlay selected marker", () => {
  afterEach(() => {
    cleanup();
  });

  test("marks exactly the selectedId row as the current model", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    const selectedName = geminiName("gemini-2.5-pro");
    const frame = lastFrame() ?? "";
    const escapedSelected = escapeRegExp(selectedName);

    // The selected row renders the "[*]" check; every other row renders "[ ]".
    expect(frame.match(new RegExp(`\\[\\*\\]\\s+${escapedSelected}`)) ?? []).toHaveLength(1);
    expect(
      (frame.match(/\[\*\]/g) ?? []).length,
      `only one row should be marked selected. Frame: ${frame}`,
    ).toBe(1);
  });

  test("starts on a non-first selected model so Enter reselects the current model", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("restores the highlighted model when a filter temporarily hides it", async () => {
    const onSelect = vi.fn();
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    const api = { ...makeGeminiApi(), activateProvider } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          selectedId="gemini-2.5-pro"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-pro")) ?? false);

    stdin.write("f");
    await flush();
    stdin.write("f");
    await flush();
    expect(lastFrame()).not.toContain(geminiName("gemini-2.5-pro"));

    stdin.write("f");
    await flush();
    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
  });
});

describe("ModelSelectOverlay large catalog windowing", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders only the visible model window and keeps the highlighted row visible while navigating the full list", async () => {
    terminalDimensions.current = { columns: 80, rows: 19 };
    const catalog = makeLargeCatalog();
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockResolvedValue(catalog);
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "large-model-25" });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
      activateProvider,
    } satisfies BoundApi;
    const onSelect = vi.fn();
    const expectedViewportRows = 4;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(
      () => lastFrame()?.includes(getLargeModelName(expectedViewportRows - 2)) ?? false,
    );

    expect(countRenderedModels(lastFrame(), catalog) + countOverflowIndicators(lastFrame())).toBe(
      expectedViewportRows,
    );
    expect(lastFrame()).toContain("\u25BC");
    expect(lastFrame()).not.toContain(getLargeModelName(expectedViewportRows - 1));

    for (let i = 0; i < 25; i += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const navigatedFrame = lastFrame();
    expect(
      countRenderedModels(navigatedFrame, catalog) + countOverflowIndicators(navigatedFrame),
    ).toBe(expectedViewportRows);
    expect(navigatedFrame).toContain("\u25B2");
    expect(navigatedFrame).toContain("\u25BC");
    expect(navigatedFrame).toContain(getLargeModelName(25));
    expect(
      countPrefixes(navigatedFrame, getLargeModelName(25)).highlighted,
      `expected the navigated model to be highlighted:\n${navigatedFrame}`,
    ).toBe(1);
    expect(navigatedFrame).not.toContain(getLargeModelName(0));

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "large-model-25");
    expect(onSelect).toHaveBeenCalledWith("large-model-25");
  });
});

describe("ModelSelectOverlay OpenRouter compatibility", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the OpenRouter structured-output compatibility label", async () => {
    const getOpenRouterModels = vi
      .fn<() => Promise<OpenRouterModelsResponse>>()
      .mockResolvedValue(OPENROUTER_MODELS);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="openrouter"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("GPT-4o") ?? false);

    expect(lastFrame()).toContain("structured outputs");
  });
});

describe("ModelSelectOverlay search input mode", () => {
  afterEach(() => {
    cleanup();
  });

  test("typing q in model search does not trigger the global quit shortcut", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("/");
    await flush();
    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("q");
    expect(lastFrame()).not.toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("a multi-character paste into the model search field lands in full", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("/");
    await flush();
    stdin.write("flash");
    await flush();

    expect(lastFrame()).toContain("flash");
  });

  test("one Escape closes from the search zone", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("Escape clears a populated search before closing the dialog", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("pro");
    await flush();
    expect(lastFrame()).toContain("pro");

    stdin.write("\u001B");
    await flushUntil(() => lastFrame()?.includes("Search models...") ?? false);

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalled();

    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("one Escape closes from the filter zone", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(lastFrame()).toContain("<-/->");
    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModelSelectOverlay long description", () => {
  afterEach(() => {
    cleanup();
  });

  test("truncates a description that overflows the row width with an ellipsis instead of the full text", async () => {
    const longDescription =
      "A very long model description that easily overflows the terminal row width FULLTAILVISIBLE";
    const catalog: ProviderModelsResponse = {
      models: [
        { id: "gemini-2.5-flash", name: "Flash", description: longDescription, tier: "free" },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    };
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockResolvedValue(catalog);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Flash") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("A very long model");
    expect(frame).toContain("…");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });

  test("keeps a wide long-name model and footer within a 40-column terminal budget", async () => {
    terminalDimensions.current = { columns: 40, rows: 19 };
    expect(terminalCellWidth("いe\u0301🙂")).toBe(5);
    const catalog: ProviderModelsResponse = {
      models: [
        {
          id: "gemini-wide-model",
          name: "Gemini 超長い Wide Model Name FULLNAMEEND",
          description:
            "A very long e\u0301🙂 model description that easily overflows the terminal row width FULLTAILVISIBLE",
          tier: "free",
        },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    };
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels: vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue(catalog),
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Gemini") ?? false);

    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines.filter((line) => line.includes("[ ]"))).toHaveLength(1);
    expect(lines.every((line) => terminalCellWidth(line) <= 40)).toBe(true);
    expect(lines).toHaveLength(15);
    expect(frame).toContain("Tab: zone");
    expect(frame).not.toContain("FULLNAMEEND");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });
});

describe("ModelSelectOverlay catalog provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows cached provenance and retries with r", async () => {
    const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue({
      ...GEMINI_CATALOG,
      source: "cache",
      cached: true,
      fetchedAt: "2026-06-02T00:00:00.000Z",
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Using cached catalog data") ?? false);
    const fallbackFrame = lastFrame() ?? "";
    expect(fallbackFrame).toContain("2026-06-02T00:00:00.000Z");
    expect(fallbackFrame).toContain("Tab: zone");
    expect(fallbackFrame.split("\n")).toHaveLength(20);

    stdin.write("r");
    await flushUntil(() => getProviderModels.mock.calls.length === 2);
    expect(getProviderModels).toHaveBeenCalledTimes(2);
  });
});
