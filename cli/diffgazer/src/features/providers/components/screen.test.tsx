import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ProviderStatus } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { CliThemeProvider } from "../../../theme/provider";
import { ProvidersScreen } from "./screen";

const TAB = "\t";
const ENTER = "\r";
const ARROW_RIGHT = "\u001b[C";

const PROVIDER_STATUS: ProviderStatus[] = [
  { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
];

afterEach(() => {
  cleanup();
});

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

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
  const boundApi = api ?? makeApi();
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <NavigationProvider initialRoute={{ screen: "settings/providers" }}>
              <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ProvidersScreen keyboard zones", () => {
  test("does not leave details focus armed when Tab is pressed before a provider is selected", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);

    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    stdin.write(ENTER);
    await flush();

    expect(lastFrame()).not.toContain("Choose how to provide");
  });

  test("moves to provider details with Tab after a provider is selected", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);

    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);

    await flushUntil(() => lastFrame()?.includes("Choose how to provide") ?? false);

    expect(lastFrame()).toContain("Choose how to provide");
  });

  test("renders a rejected credentials deletion exactly once", async () => {
    const message = "credentials delete failed";
    const deleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockRejectedValue(new Error(message));
    const api = { ...makeApi(), deleteProviderCredentials } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);

    await flushUntil(() => lastFrame()?.includes(message) ?? false);

    expect(deleteProviderCredentials).toHaveBeenCalledWith("gemini");
    expect(lastFrame()?.split(message)).toHaveLength(2);
  });
});
