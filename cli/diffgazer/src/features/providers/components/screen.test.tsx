import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ProviderModelsResponse, ProviderStatus } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { GlobalShortcuts } from "../../../app/root";
import { useNavigation } from "../../../hooks/use-navigation";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { ProvidersScreen } from "./screen";

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({ data: undefined, isLoading: false }),
}));

const TAB = "\t";
const ENTER = "\r";
const ARROW_RIGHT = "\u001b[C";

const PROVIDER_STATUS: ProviderStatus[] = [
  { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
];

afterEach(() => {
  cleanup();
  cleanupRootFrames();
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

function makeApi(providerStatus: ProviderStatus[] = PROVIDER_STATUS): BoundApi {
  const getProviderStatus = vi
    .fn<() => Promise<ProviderStatus[]>>()
    .mockResolvedValue(providerStatus);
  const models: ProviderModelsResponse = {
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast model",
        tier: "free",
      },
    ],
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
  const getProviderModels = vi
    .fn<() => Promise<ProviderModelsResponse>>()
    .mockResolvedValue(models);
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getProviderStatus,
    getProviderModels,
  } satisfies BoundApi;
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

function RouteProbe() {
  const { route } = useNavigation();
  return <Text>{`route:${route.screen}`}</Text>;
}

function ProvidersApiBoundary({ api }: { api: BoundApi }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ApiProvider value={api}>
        <ProvidersScreen />
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

  test("activates a configured provider with its resolved model", async () => {
    const activateProvider = vi
      .fn<BoundApi["activateProvider"]>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-flash" });
    const api = {
      ...makeApi([
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
      ]),
      activateProvider,
    } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Set Active") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => activateProvider.mock.calls.length === 1);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-flash");
  });

  test("keeps medium provider rows and action labels on whole lines", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Configure API Key") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Configure API Key");
    expect(frame).toContain("Select Model");
    expect(frame).toContain("Remove Key");
    expect(frame).not.toMatch(/\[●\s+needs\s*\n/i);
  });

  test.each([
    { title: "Configure API Key", moveToAction: 0 },
    { title: "Select Model", moveToAction: 1 },
  ])("swaps provider panes for the $title dialog inside an 80 by 24 root frame", async ({
    title,
    moveToAction,
  }) => {
    const view = renderRootFrame(80, 24, <ProvidersApiBoundary api={makeApi()} />);

    await flushUntil(
      () => view.lastFrame()?.includes("Select a provider to view details") ?? false,
    );
    view.stdin.write(ENTER);
    await flushUntil(() => view.lastFrame()?.includes("gemini-2.5-flash") ?? false);
    view.stdin.write(TAB);
    await flush();
    for (let index = 0; index < moveToAction; index += 1) {
      view.stdin.write(ARROW_RIGHT);
      await flush();
    }
    view.stdin.write(ENTER);
    await flushUntil(() => view.lastFrame()?.includes(title) ?? false);

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain(title);
    expect(frame).not.toContain("Select a provider to view details");
  });

  test("suppresses the help shortcut while the model dialog is open", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <GlobalShortcuts onExit={() => {}} />
        <ProvidersScreen />
        <RouteProbe />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select a provider to view details") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    stdin.write("?");
    await flush();

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("route:settings/providers");
  });
});
