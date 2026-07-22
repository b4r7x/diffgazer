import "./model-select-overlay.terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { escapeRegExp } from "../../../testing/escape-regexp";
import { CliThemeProvider } from "../../../theme/provider";

export const ARROW_UP = "\u001b[A";
export const ARROW_DOWN = "\u001b[B";

// Free-first 5-model Gemini layout (3 free, 2 paid), matching the catalog's
// deterministic free-first ordering. The transform (P1) produces this order; the
// overlay test feeds the same shape over the boundary-mocked api.
export const GEMINI_CATALOG: ProviderModelsResponse = {
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

export function geminiName(id: string): string {
  const model = GEMINI_CATALOG.models.find((m) => m.id === id);
  if (!model) throw new Error(`Gemini catalog fixture is missing model "${id}"`);
  return model.name ?? id;
}

export async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Poll on a macrotask boundary. React Query resolves the mocked api over a
// microtask chain whose React-scheduler commit can land a few macrotasks later,
// and a mounted ink Spinner runs a real setInterval; yielding to setTimeout(0)
// each attempt lets both settle deterministically instead of racing setImmediate.
export async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

export function makeGeminiApi(): BoundApi {
  const getProviderModels = vi
    .fn<() => Promise<ProviderModelsResponse>>()
    .mockResolvedValue(GEMINI_CATALOG);
  return { ...createApi({ baseUrl: "http://localhost" }), getProviderModels } satisfies BoundApi;
}

export function countPrefixes(
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

export function Wrapper({ children, api }: { children: ReactNode; api?: BoundApi }) {
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

export function StableWrapper({
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
