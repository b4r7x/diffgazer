import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY, UNRECOGNIZED_CONFIGURATION_COPY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import {
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  READINESS_PRESENTATION,
} from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeAllConfigurationsListResponse,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GlobalShortcuts } from "../../../app/global-shortcuts";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import { useNavigation } from "../../../hooks/use-navigation";
import { flush } from "../../../testing/flush";
import { createTestQueryClient } from "../../../testing/query-client";
import {
  cleanupRootFrames,
  type RootFrameView,
  renderRootFrame,
} from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { ProvidersScreen } from "./screen";

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useConfigurationInit: () => ({
    data: {
      schemaVersion: 2 as const,
      configurations: makeAllConfigurationsListResponse().configurations,
      selectedConfigurationId: "gemini-primary" as const,
      settings: {
        theme: "terminal" as const,
        defaultLenses: [],
        defaultProfile: null,
        severityThreshold: "low" as const,
        secretsStorage: null,
        agentExecution: "parallel" as const,
      },
      project: { projectId: "proj-1", path: "/repo", trust: null },
      setup: {
        hasSecretsStorage: false,
        hasProvider: true,
        hasModel: true,
        hasTrust: false,
        isConfigured: true,
        isReady: true,
        missing: ["trust", "secrets storage"],
      },
    },
    isLoading: false,
  }),
}));

vi.mock("../../../components/layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../components/layout/global")>();
  const { useTerminalDimensions } = await import("../../../hooks/use-terminal-dimensions");
  return {
    ...actual,
    useContentZone: () => {
      const { columns, rows } = useTerminalDimensions();
      return {
        columns,
        contentColumns: columns,
        contentRows: actual.getContentZoneRows(rows),
      };
    },
  };
});

const TAB = "\t";
const ENTER = "\r";
const ARROW_RIGHT = "\u001b[C";
const ARROW_LEFT = "\u001b[D";

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for condition after ${attempts} attempts`);
}

async function pressRoot(view: RootFrameView, input: string): Promise<void> {
  view.stdin.write(input);
  await flush();
}

async function flushUntilRoot(
  _view: RootFrameView,
  predicate: () => boolean,
  attempts = 500,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for root frame condition after ${attempts} attempts`);
}

function geminiCatalogModelsResponse(): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: GEMINI_CONFIGURATION.configurationId,
    productId: GEMINI_CONFIGURATION.productId,
    transportFamily: GEMINI_CONFIGURATION.transportFamily,
    models: [
      {
        id: "gemini-2.5-flash",
        name: "gemini-2.5-flash",
        description: "1M context",
        tier: "paid",
      },
    ],
    checkedAt: "2026-07-31T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

function makeApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    listConfigurations: vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(makeAllConfigurationsListResponse()),
    createConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    selectConfiguration: vi.fn(),
    deleteConfiguration: vi.fn(),
    inspectConfiguration: vi.fn(),
    // Model discovery is a real query: an undefined resolution makes React
    // Query throw and the dialog renders an error footer instead of its list.
    getConfigurationModels: vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(geminiCatalogModelsResponse()),
  } satisfies BoundApi;
}

function Wrapper({ children, api }: { children: ReactNode; api?: BoundApi }) {
  const boundApi = api ?? makeApi();
  return (
    <QueryClientProvider client={createTestQueryClient()}>
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

function FooterProbe() {
  const { shortcuts, rightShortcuts } = useFooterData();
  const format = (list: typeof shortcuts) =>
    list.map((shortcut) => `[${shortcut.key}] ${shortcut.label}`).join(" ");
  return <Text>{`FOOTER ${format(shortcuts)} | ${format(rightShortcuts)}`}</Text>;
}

function RouteProbe() {
  const { route } = useNavigation();
  return <Text>{`route:${route.screen}`}</Text>;
}

function ProvidersApiBoundary({ api }: { api: BoundApi }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <FooterProvider initialShortcuts={[]}>
              <ProvidersScreen />
            </FooterProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ProvidersScreen V2 products and readiness", () => {
  test("opens with the selected configuration already in the details pane", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("Select a provider to view details");
    expect(frame).toContain("Google Gemini");
    // The pane names the configured model in full: catalog name, then the id a review pins.
    expect(frame).toContain("Gemini 2.5 Flash · gemini-2.5-flash");
    expect(frame).toContain("Ready");
    expect(frame).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(frame).not.toContain("API Key Status");
  });

  test("lists selectable products from the V2 roster", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    expect(lastFrame()).toContain(PRODUCT_REGISTRY.zai.presentation.name);
  });

  test("shows CLI unsupported evidence in the provider list", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("CLI unsupported") ?? false);
    expect(lastFrame()).toContain("CLI unsupported");
  });

  // Retiring a product turns its stored record into bytes this build cannot
  // decode. It trails the product rows so it does not become permanent: it names
  // itself honestly and offers removal alone.
  test("offers only removal for a stored record this build could not decode", async () => {
    const api = makeApi();
    vi.mocked(api.listConfigurations).mockResolvedValue({
      ...makeAllConfigurationsListResponse(),
      unrecognizedConfigurations: [{ configurationId: "cfg-retired" }],
    });

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(UNRECOGNIZED_CONFIGURATION_COPY.label) ?? false);
    // The list wraps, so one step up from the first product row lands on the
    // record trailing every one of them.
    stdin.write("\u001b[A");
    // Both surfaces render the copy core owns, so neither can describe the same
    // record differently. The pane wraps the sentence over its own width, so the
    // frame is matched on the leading clause it keeps whole.
    const [descriptionLead] = UNRECOGNIZED_CONFIGURATION_COPY.description.split(". ");
    await flushUntil(() => lastFrame()?.includes(descriptionLead ?? "") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("cfg-retired");
    expect(frame).toContain("Delete configuration");
    expect(frame).not.toContain("Select model");
    expect(frame).not.toContain("Update configuration");
  });
});

describe("ProvidersScreen keyboard zones", () => {
  test("moves the details pane with the highlight, without pressing Enter", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write("\u001b[B");
    await flushUntil(() => lastFrame()?.includes("Z.AI") ?? false);
    expect(lastFrame()).toContain("Z.AI");
  });

  test("moves to provider details with Tab after a provider is selected", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Update configuration") ?? false);
    expect(lastFrame()).toContain("Update configuration");
  });

  test("renders a rejected configuration deletion exactly once", async () => {
    const message = "configuration delete failed";
    const deleteConfiguration = vi
      .fn<BoundApi["deleteConfiguration"]>()
      .mockRejectedValue(new Error(message));
    const api = { ...makeApi(), deleteConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    for (let index = 0; index < 2; index += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes(message) ?? false);

    expect(deleteConfiguration).toHaveBeenCalled();
    expect(lastFrame()?.split(message)).toHaveLength(2);
  });

  test("reports a readiness test that the server answers as failed", async () => {
    const explanation = READINESS_PRESENTATION["conformance-failed"].explanation;
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "failed",
      configuration: GEMINI_CONFIGURATION,
      readiness: makeReadiness("conformance-failed"),
    });
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(
        makeConfigurationListResponse(
          makeConfigurationInitResponse([
            configurationStatus(GEMINI_CONFIGURATION, "conformance-pending"),
          ]),
        ),
      );
    const api = { ...makeApi(), listConfigurations, testConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Test readiness") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => testConfiguration.mock.calls.length === 1);
    await flushUntil(() => lastFrame()?.includes(explanation) ?? false);

    expect(lastFrame()).toContain(explanation);
  });

  test("drops a failed action once a later action succeeds", async () => {
    const message = "configuration delete failed";
    const deleteConfiguration = vi
      .fn<BoundApi["deleteConfiguration"]>()
      .mockRejectedValue(new Error(message));
    const readyStatus = requireValue(
      makeAllConfigurationsListResponse().configurations[0],
      "first configuration",
    );
    const selectConfiguration = vi.fn<BoundApi["selectConfiguration"]>().mockResolvedValue({
      action: "select",
      status: "succeeded",
      configuration: readyStatus.configuration,
      readiness: readyStatus.readiness,
    });
    const api = { ...makeApi(), deleteConfiguration, selectConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(TAB);
    await flush();
    for (let index = 0; index < 2; index += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes(message) ?? false);

    for (let index = 0; index < 2; index += 1) {
      stdin.write(ARROW_LEFT);
      await flush();
    }
    stdin.write(ENTER);
    await flushUntil(() => selectConfiguration.mock.calls.length === 1);
    await flushUntil(() => !(lastFrame()?.includes(message) ?? true));

    expect(lastFrame()).not.toContain(message);
  });

  test("renders the sanitized error and hides provider rows when configurations fail to load", async () => {
    const message = "configuration list failed";
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockRejectedValue(new Error(message));
    const api = { ...makeApi(), listConfigurations } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(message) ?? false);
    expect(lastFrame()).toContain(message);
    expect(lastFrame()).not.toContain("Google Gemini");
  });

  test("selects a ready configuration through the primary action", async () => {
    const readyStatus = requireValue(
      makeAllConfigurationsListResponse().configurations[0],
      "first configuration",
    );
    const selectConfiguration = vi.fn<BoundApi["selectConfiguration"]>().mockResolvedValue({
      action: "select",
      status: "succeeded",
      configuration: readyStatus.configuration,
      readiness: readyStatus.readiness,
    });
    const api = { ...makeApi(), selectConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => selectConfiguration.mock.calls.length === 1);

    expect(selectConfiguration).toHaveBeenCalledWith(
      "gemini-primary",
      readyStatus.configuration.selectedModelId,
    );
  });

  test("keeps provider rows and action labels on whole lines", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Update configuration") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Update configuration");
    expect(frame).toContain("Select model");
    expect(frame).toContain("Delete configuration");
    expect(frame).not.toMatch(/\[●\s+needs\s*\n/i);
  });

  test("runs its panes down to the shortcut bar at 100x30", async () => {
    const view = renderRootFrame(100, 30, <ProvidersApiBoundary api={makeApi()} />);

    await flushUntil(() => {
      const lines = stripAnsi(view.lastFrame() ?? "").split("\n");
      return lines.some((line) => /[└┗]/.test(line));
    });
    const lines = stripAnsi(view.lastFrame() ?? "").split("\n");
    const bottomBorder = lines.findLastIndex((line) => /[└┗]/.test(line));

    expect(bottomBorder).toBeGreaterThan(0);
    expect(lines.length - 1 - bottomBorder).toBeLessThanOrEqual(1);
  });

  test.each([
    { title: "Update Configuration", moveToAction: 1 },
    { title: "Select Model", moveToAction: 3 },
  ])("swaps provider panes for the $title dialog inside an 80 by 24 root frame", async ({
    title,
    moveToAction,
  }) => {
    const view = renderRootFrame(80, 24, <ProvidersApiBoundary api={makeApi()} />);

    await flushUntilRoot(view, () => view.lastFrame()?.includes("Google Gemini") ?? false);
    await pressRoot(view, ENTER);
    await flushUntilRoot(view, () => view.lastFrame()?.includes("gemini-2.5-flash") ?? false);
    await pressRoot(view, TAB);
    for (let index = 0; index < moveToAction; index += 1) {
      await pressRoot(view, ARROW_RIGHT);
    }
    await pressRoot(view, ENTER);
    await flushUntilRoot(view, () => view.lastFrame()?.includes(title) ?? false);
    expect(view.lastFrame()).toContain(title);
  });

  test.each([
    {
      title: "Select Model",
      moveToAction: 3,
      expectedFooter:
        "FOOTER [Tab] Switch Zone [/] Search [f] Filter Tier [Enter] Select | [Esc] Close",
    },
    {
      title: "Update Configuration",
      moveToAction: 1,
      expectedFooter:
        "FOOTER [Tab] Focus Key Field [←/→] Switch Action [Enter] Confirm | [Esc] Close",
    },
  ])("hands the shortcut bar to the $title overlay while it is open", async ({
    title,
    moveToAction,
    expectedFooter,
  }) => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    await flushUntil(() => lastFrame()?.includes("[Enter] Select") ?? false);
    expect(lastFrame()).toContain("FOOTER [Esc] Back [Enter] Select |");

    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    for (let index = 0; index < moveToAction; index += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes(title) ?? false);
    await flushUntil(() => lastFrame()?.includes(expectedFooter) ?? false);
    expect(lastFrame()).toContain(expectedFooter);
  });

  test("keeps the OpenRouter model overlay open after create and configuration refetch", async () => {
    const openRouterNotice = PRODUCT_REGISTRY.openrouter.notice;
    const openRouterConfiguration = {
      configurationId: "openrouter-primary",
      revision: 1,
      status: "supported",
      transportFamily: "hosted-api",
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      selectedModelId: null,
      notices: [
        {
          ...openRouterNotice,
          billing: [...openRouterNotice.billing],
          privacy: [...openRouterNotice.privacy],
        },
      ],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    } satisfies ClientConfigurationSummary;
    const openRouterStatus = configurationStatus(openRouterConfiguration, "model-missing");

    let listResponse = makeConfigurationListResponse(
      makeConfigurationInitResponse([
        configurationStatus(GEMINI_CONFIGURATION, "ready"),
        configurationStatus(ZAI_CONFIGURATION, "ready"),
      ]),
    );
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockImplementation(async () => listResponse);
    const createConfiguration = vi
      .fn<BoundApi["createConfiguration"]>()
      .mockImplementation(async () => {
        listResponse = makeConfigurationListResponse(
          makeConfigurationInitResponse([
            configurationStatus(GEMINI_CONFIGURATION, "ready"),
            openRouterStatus,
          ]),
        );
        return {
          action: "create",
          status: "succeeded",
          configuration: openRouterConfiguration,
        };
      });
    const openRouterModels: ConfigurationModelsResponse = {
      status: "passed",
      configurationId: openRouterConfiguration.configurationId,
      productId: openRouterConfiguration.productId,
      transportFamily: openRouterConfiguration.transportFamily,
      models: [
        {
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          description: "200K context",
          tier: "paid",
        },
      ],
      checkedAt: "2026-07-31T12:00:00.000Z",
      source: "snapshot",
      cached: false,
    };
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(openRouterModels);
    const api = {
      ...makeApi(),
      listConfigurations,
      createConfiguration,
      getConfigurationModels,
    } satisfies BoundApi;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write("\u001b[B");
    await flush();
    stdin.write("\u001b[B");
    await flushUntil(
      () => lastFrame()?.includes(PRODUCT_REGISTRY.openrouter.presentation.name) ?? false,
    );
    stdin.write(ENTER);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Create Configuration") ?? false);
    stdin.write("a");
    await flushUntil(() => lastFrame()?.includes("Notice accepted") ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("sk-openrouter-test");
    await flush();
    stdin.write("\t");
    await flush();
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);

    expect(createConfiguration).toHaveBeenCalledOnce();
    expect(listConfigurations.mock.calls.length).toBeGreaterThan(1);
    expect(lastFrame()).toContain("Select Model");
  });

  test("suppresses the help shortcut while the model dialog is open", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <GlobalShortcuts onExit={() => {}} />
        <ProvidersScreen />
        <RouteProbe />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    stdin.write(TAB);
    await flush();
    for (let index = 0; index < 3; index += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    stdin.write("?");
    await flush();

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("route:settings/providers");
  });
});
