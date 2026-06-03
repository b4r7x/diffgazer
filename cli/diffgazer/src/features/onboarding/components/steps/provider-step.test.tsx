import { test, describe, afterEach, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, cleanup } from "ink-testing-library";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import type { ProviderStatus } from "@diffgazer/core/schemas/config";
import { CliThemeProvider } from "../../../../theme/theme-context";
import { ProviderStep } from "./provider-step";

const PROVIDER_STATUS: ProviderStatus[] = [
  { provider: "gemini", hasApiKey: false, isActive: false },
  { provider: "openrouter", hasApiKey: false, isActive: false },
];

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

function makeApi(): BoundApi {
  const getProviderStatus = vi
    .fn<() => Promise<ProviderStatus[]>>()
    .mockResolvedValue(PROVIDER_STATUS);
  return { ...createApi({ baseUrl: "http://localhost" }), getProviderStatus } satisfies BoundApi;
}

function Wrapper({ children, api }: { children: ReactNode; api?: BoundApi }) {
  const queryClient = makeQueryClient();
  const boundApi = api ?? makeApi();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">{children}</CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ProviderStep (TUI)", () => {
  afterEach(() => {
    cleanup();
  });

  test("lists providers by display name and describes OpenRouter", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ProviderStep value="gemini" onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);

    const frame = lastFrame();
    expect(frame).toContain("Google Gemini");
    expect(frame).toContain("OpenRouter");
    expect(frame).toContain("Access multiple providers via a single API");
  });
});
