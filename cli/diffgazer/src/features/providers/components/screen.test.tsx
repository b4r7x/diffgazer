import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY, UNRECOGNIZED_CONFIGURATION_COPY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
  SettingsConfig,
} from "@diffgazer/core/schemas/config";
import {
  DEFAULT_SETTINGS,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  PROVIDER_CONSENT_TEXT,
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
  OPENROUTER_CONFIGURATION,
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
        providerConsent: null,
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
const ESCAPE = "\u001b";
const ARROW_RIGHT = "\u001b[C";
const ARROW_LEFT = "\u001b[D";
const ARROW_DOWN = "\u001b[B";
const ARROW_UP = "\u001b[A";

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

const RECORDED_CONSENT_SETTINGS = {
  ...DEFAULT_SETTINGS,
  providerConsent: { version: 1 as const, acceptedAt: "2026-08-01T09:00:00.000Z" },
};

function makeApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    // Consent is on record in the steady state; the first-run test overrides it.
    getSettings: vi.fn<BoundApi["getSettings"]>().mockResolvedValue(RECORDED_CONSENT_SETTINGS),
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

function Wrapper({
  children,
  api,
  initialRoute = { screen: "settings/providers" },
}: {
  children: ReactNode;
  api?: BoundApi;
  initialRoute?: Parameters<typeof NavigationProvider>[0]["initialRoute"];
}) {
  const boundApi = api ?? makeApi();
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <NavigationProvider initialRoute={initialRoute}>
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
    // Consent is on record, so nothing asks for it.
    expect(frame).not.toContain("Consent required");
  });

  test("opens the model dialog for the active configuration on a select-model deep link, once", async () => {
    // The active configuration is not the first row, so landing on the dialog
    // for it proves the deep link followed the selection, not the highlight.
    const listConfigurations = vi.fn<BoundApi["listConfigurations"]>().mockResolvedValue({
      ...makeAllConfigurationsListResponse(),
      selectedConfigurationId: "zai-primary",
    });
    const api = { ...makeApi(), listConfigurations } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api} initialRoute={{ screen: "settings/providers", intent: "select-model" }}>
        <ProvidersScreen />
      </Wrapper>,
    );

    // "Change model" on the review error screen lands in the dialog itself.
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    // The subtitle names the configuration's product, so it tells the rows apart.
    expect(lastFrame()).toContain(ZAI_CONFIGURATION.productId);

    // Closing it stays closed: the intent is one-shot, not a sticky reopen.
    stdin.write(ESCAPE);
    await flushUntil(() => !(lastFrame()?.includes("Select Model") ?? true));
    await flush();
    expect(lastFrame()).not.toContain("Select Model");
  });

  test("gates Verify behind the provider consent: Not now cancels, Enter accepts and continues", async () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "succeeded",
      configuration: GEMINI_CONFIGURATION,
      readiness: makeReadiness("ready"),
    });
    const settings: SettingsConfig = { ...DEFAULT_SETTINGS, providerConsent: null };
    const getSettings = vi.fn<BoundApi["getSettings"]>().mockImplementation(async () => settings);
    const saveSettings = vi.fn<BoundApi["saveSettings"]>().mockImplementation(async (patch) => {
      Object.assign(settings, patch);
    });
    const api = { ...makeApi(), getSettings, saveSettings, testConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    // The details pane says how to get back to the notice, in the footer too.
    expect(lastFrame()).toContain("Consent required to run reviews · [c] Review");
    expect(lastFrame()).toContain("[c] Review");

    stdin.write("v");
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    // The notice wraps to the card width, so its opening words stand for the text.
    expect(lastFrame()).toContain(PROVIDER_CONSENT_TEXT.slice(0, 32));
    expect(lastFrame()).toContain("[ Accept and continue ]");
    expect(lastFrame()).toContain("FOOTER [←/→] Switch Action [Enter] Accept | [Esc] Not now");
    expect(testConfiguration).not.toHaveBeenCalled();

    // Not now: nothing saved, nothing sent, the panes are back.
    stdin.write(ESCAPE);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(testConfiguration).not.toHaveBeenCalled();

    // Enter accepts: the consent is recorded once, then Verify runs.
    stdin.write("v");
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => testConfiguration.mock.calls.length === 1);
    expect(saveSettings).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });

    // Recorded: the next gated action runs at once, and the reminder is gone.
    await flushUntil(() => !(lastFrame()?.includes("Consent required") ?? true));
    stdin.write("v");
    await flushUntil(() => testConfiguration.mock.calls.length === 2);
    expect(lastFrame()).not.toContain("Provider data notice");
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  test("gates setup and selection too, and c reopens the notice from the details pane", async () => {
    const selectConfiguration = vi.fn<BoundApi["selectConfiguration"]>().mockResolvedValue({
      action: "select",
      status: "succeeded",
      configuration: GEMINI_CONFIGURATION,
      readiness: makeReadiness("ready"),
    });
    const settings: SettingsConfig = { ...DEFAULT_SETTINGS, providerConsent: null };
    const getSettings = vi.fn<BoundApi["getSettings"]>().mockImplementation(async () => settings);
    const saveSettings = vi.fn<BoundApi["saveSettings"]>().mockImplementation(async (patch) => {
      Object.assign(settings, patch);
    });
    // Another configuration is active, so Gemini keeps Select configuration as its primary.
    const listConfigurations = vi.fn<BoundApi["listConfigurations"]>().mockResolvedValue({
      ...makeAllConfigurationsListResponse(),
      selectedConfigurationId: "zai-primary",
    });
    const api = {
      ...makeApi(),
      getSettings,
      saveSettings,
      selectConfiguration,
      listConfigurations,
    } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    // Enter in the list runs the highlighted row's primary, Select configuration,
    // and the footer says so; the notice stands between the key and the send.
    expect(lastFrame()).toContain(
      "FOOTER [Esc] Back [Enter] Select configuration [m] Model [e] Edit [v] Verify [d] Delete [c] Review |",
    );
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    expect(selectConfiguration).not.toHaveBeenCalled();
    stdin.write(ESCAPE);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    // Tab into the details pane: Enter there runs the same primary.
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    expect(selectConfiguration).not.toHaveBeenCalled();
    stdin.write(ESCAPE);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);

    // e opens setup: the credentials overlay waits behind the notice.
    stdin.write("e");
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    expect(lastFrame()).not.toContain("Update Configuration");
    stdin.write(ESCAPE);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    expect(lastFrame()).not.toContain("Update Configuration");

    // c opens the notice on its own: nothing waits behind it, so it just accepts.
    stdin.write("c");
    await flushUntil(() => lastFrame()?.includes("Provider data notice") ?? false);
    expect(lastFrame()).toContain("[ Accept ]");
    expect(lastFrame()).not.toContain("[ Accept and continue ]");
    stdin.write(ENTER);
    await flushUntil(() => saveSettings.mock.calls.length === 1);
    expect(selectConfiguration).not.toHaveBeenCalled();

    // Recorded: Enter back in the list selects the configuration at once.
    await flushUntil(() => !(lastFrame()?.includes("[c] Review") ?? true));
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => selectConfiguration.mock.calls.length === 1);
    expect(lastFrame()).not.toContain("Provider data notice");
  });

  test("opens the model picker from a model-missing primary without asking for consent", async () => {
    const getSettings = vi
      .fn<BoundApi["getSettings"]>()
      .mockResolvedValue({ ...DEFAULT_SETTINGS, providerConsent: null });
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(
        makeConfigurationListResponse(
          makeConfigurationInitResponse([
            configurationStatus(OPENROUTER_CONFIGURATION, "model-missing"),
          ]),
        ),
      );
    const api = { ...makeApi(), getSettings, listConfigurations } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("OpenRouter") ?? false);
    // Walk the highlight down to the stored record; the details pane follows it.
    await flushUntil(() => {
      if (lastFrame()?.includes("[Enter] Select model")) return true;
      stdin.write(ARROW_DOWN);
      return false;
    });
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);

    expect(lastFrame()).not.toContain("Provider data notice");
  });

  test("keeps loading until settings resolve, so the setup overlay never reads consent as missing", async () => {
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(makeAllConfigurationsListResponse());
    const getSettings = vi.fn<BoundApi["getSettings"]>().mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(
      <Wrapper api={{ ...makeApi(), listConfigurations, getSettings }}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => listConfigurations.mock.calls.length === 1);
    await flush();
    expect(lastFrame()).toContain("Loading providers...");
    expect(lastFrame()).not.toContain("Google Gemini");
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
    expect(frame).toContain("[ More ]");
    expect(frame).not.toContain("Select model");
    expect(frame).not.toContain("Update configuration");

    // Removal is the one live entry in More; d asks for it directly, naming the record.
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("d. Delete configuration") ?? false);
    expect(lastFrame()?.match(/Only removal is available/g)).toHaveLength(3);
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    expect(lastFrame()).toContain(`Removes ${UNRECOGNIZED_CONFIGURATION_COPY.label}`);
    expect(api.deleteConfiguration).not.toHaveBeenCalled();
    // A successful delete invalidates the config caches; the refetched list no
    // longer carries the record, so its row leaves the frame.
    vi.mocked(api.listConfigurations).mockResolvedValue(makeAllConfigurationsListResponse());
    stdin.write(ARROW_LEFT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => vi.mocked(api.deleteConfiguration).mock.calls.length === 1);
    expect(api.deleteConfiguration).toHaveBeenCalledWith("cfg-retired", undefined);
    await flushUntil(() => !(lastFrame()?.includes(UNRECOGNIZED_CONFIGURATION_COPY.label) ?? true));
    expect(lastFrame()).not.toContain("cfg-retired");
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
    // Gemini is the active configuration: its row is Change model, then More.
    expect(lastFrame()).toContain("[● Active]");
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("More actions — Google Gemini") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("e. Update configuration");
    expect(frame).toContain("v. Verify");
    expect(frame).toContain("d. Delete configuration");
  });

  test("crosses into the details pane with ArrowRight, onto its action row", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("[ Change model ]") ?? false);
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("More actions — Google Gemini") ?? false);

    expect(lastFrame()).toContain("More actions — Google Gemini");
  });

  test("returns to the list row that sent focus only at the details pane's left edge", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("[ Change model ]") ?? false);
    for (const key of [ARROW_RIGHT, ARROW_RIGHT, ARROW_LEFT, ARROW_DOWN]) {
      stdin.write(key);
      await flush();
    }
    expect(lastFrame()).toContain("[ Change model ]");
    expect(lastFrame()).not.toContain("[ Select configuration ]");

    stdin.write(ARROW_LEFT);
    await flush();
    stdin.write(ARROW_DOWN);
    await flushUntil(() => lastFrame()?.includes("[ Select configuration ]") ?? false);

    expect(lastFrame()).toContain("[ Select configuration ]");
  });

  test("keeps every menu entry in place and explains the ones the state cannot run", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    for (let step = 0; step < 3; step += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }
    await flushUntil(
      () => lastFrame()?.includes(PRODUCT_REGISTRY.deepseek.presentation.name) ?? false,
    );
    await flushUntil(() => lastFrame()?.includes("[ Configure ]") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("More actions — DeepSeek") ?? false);

    const frame = lastFrame() ?? "";
    for (const label of [
      "Update configuration",
      "Verify",
      "Select model",
      "Delete configuration",
    ]) {
      expect(frame).toContain(label);
    }
    expect(frame.match(/Configure this provider first/g)).toHaveLength(4);
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
    // d asks first; the key repeated on the confirmation deletes nothing, and
    // the confirmation opens on Cancel, so only a move to Delete then Enter does.
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    expect(lastFrame()).toContain("Removes Google Gemini and its stored credentials");
    expect(lastFrame()).toContain("[ Delete ]");
    expect(lastFrame()).toContain("[ Cancel ]");
    stdin.write("dd");
    await flush();
    expect(deleteConfiguration).not.toHaveBeenCalled();
    stdin.write(ARROW_LEFT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes(message) ?? false);

    expect(deleteConfiguration).toHaveBeenCalledWith("gemini-primary", 1);
    expect(lastFrame()?.split(message)).toHaveLength(2);
    expect(lastFrame()).not.toContain("Delete configuration?");
  });

  test("keeps the configuration when the delete confirmation is declined", async () => {
    const deleteConfiguration = vi.fn<BoundApi["deleteConfiguration"]>();
    const api = { ...makeApi(), deleteConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    // It opens on Cancel: Enter as it stands keeps the configuration.
    expect(lastFrame()).toContain("FOOTER [←/→] Switch Action [Enter] Cancel | [Esc] Cancel");
    stdin.write(ARROW_LEFT);
    await flush();
    expect(lastFrame()).toContain("FOOTER [←/→] Switch Action [Enter] Delete | [Esc] Cancel");
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => !(lastFrame()?.includes("Delete configuration?") ?? true));
    expect(deleteConfiguration).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("Google Gemini");

    // Escape declines too, from the More menu's own d.
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("More actions — Google Gemini") ?? false);
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    stdin.write("\u001b");
    await flushUntil(() => !(lastFrame()?.includes("Delete configuration?") ?? true));
    expect(deleteConfiguration).not.toHaveBeenCalled();
    expect(lastFrame()).not.toContain("More actions");
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

    await flushUntil(() => lastFrame()?.includes("Not verified") ?? false);
    // Verify lives behind More; its accelerator runs it from the list.
    stdin.write("v");
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
    // Another configuration is active, so Gemini keeps Select configuration as its primary.
    const listConfigurations = vi.fn<BoundApi["listConfigurations"]>().mockResolvedValue({
      ...makeAllConfigurationsListResponse(),
      selectedConfigurationId: "zai-primary",
    });
    const api = {
      ...makeApi(),
      deleteConfiguration,
      selectConfiguration,
      listConfigurations,
    } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    stdin.write(ARROW_LEFT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes(message) ?? false);

    stdin.write(TAB);
    await flush();
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
    // Another configuration is active, so Gemini keeps Select configuration as its primary.
    const listConfigurations = vi.fn<BoundApi["listConfigurations"]>().mockResolvedValue({
      ...makeAllConfigurationsListResponse(),
      selectedConfigurationId: "zai-primary",
    });
    const api = { ...makeApi(), selectConfiguration, listConfigurations } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("[ Select configuration ]") ?? false);
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
    await flushUntil(() => lastFrame()?.includes("[ Change model ]") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ More ]");
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

  // Gemini is the active configuration: its row is Change model, then More, and
  // the More menu opens on Update configuration.
  test.each([
    { title: "Select Model", keys: [TAB, ENTER] },
    { title: "More actions — Google Gemini", keys: [TAB, ARROW_RIGHT, ENTER] },
    { title: "Update Configuration", keys: [TAB, ARROW_RIGHT, ENTER, ENTER] },
  ])("swaps provider panes for the $title dialog inside an 80 by 24 root frame", async ({
    title,
    keys,
  }) => {
    const view = renderRootFrame(80, 24, <ProvidersApiBoundary api={makeApi()} />);

    await flushUntilRoot(view, () => view.lastFrame()?.includes("Google Gemini") ?? false);
    await pressRoot(view, ENTER);
    await flushUntilRoot(view, () => view.lastFrame()?.includes("gemini-2.5-flash") ?? false);
    for (const key of keys) {
      await pressRoot(view, key);
    }
    await flushUntilRoot(view, () => view.lastFrame()?.includes(title) ?? false);
    const frame = stripAnsi(view.lastFrame() ?? "");
    expect(frame).toContain(title);
    expect(frame.split("\n")).toHaveLength(24);
  });

  test.each([
    {
      title: "Select Model",
      keys: [TAB, ENTER],
      expectedFooter:
        "FOOTER [Tab] Switch Zone [/] Search [f] Filter Tier [Enter] Select | [Esc] Close",
    },
    {
      title: "More actions — Google Gemini",
      keys: [TAB, ARROW_RIGHT, ENTER],
      expectedFooter: "FOOTER [↑/↓] Navigate [Enter] Run | [Esc] Close",
    },
    {
      title: "Update Configuration",
      keys: [TAB, ARROW_RIGHT, ENTER, ENTER],
      expectedFooter:
        "FOOTER [Tab] Focus Key Field [↑/↓] Navigate [Space] Select Method [Enter] Confirm | [Esc] Close",
    },
  ])("hands the shortcut bar to the $title overlay while it is open", async ({
    title,
    keys,
    expectedFooter,
  }) => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // The keybar teaches only the accelerators the highlighted row can run.
    await flushUntil(() => lastFrame()?.includes("[d] Delete") ?? false);
    expect(lastFrame()).toContain("FOOTER [Esc] Back [m] Model [e] Edit [v] Verify [d] Delete |");

    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    for (const key of keys) {
      stdin.write(key);
      await flush();
    }
    await flushUntil(() => lastFrame()?.includes(title) ?? false);
    await flushUntil(() => lastFrame()?.includes(expectedFooter) ?? false);
    expect(lastFrame()).toContain(expectedFooter);
  });

  test("retells the setup footer as the key field takes and releases focus", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    for (const key of [TAB, ARROW_RIGHT, ENTER, ENTER]) {
      stdin.write(key);
      await flush();
    }
    await flushUntil(() => lastFrame()?.includes("Update Configuration") ?? false);

    stdin.write(TAB);
    await flushUntil(
      () =>
        lastFrame()?.includes("FOOTER [↑/↓] Leave Field [Enter] Confirm | [Esc] Close") ?? false,
    );

    stdin.write(TAB);
    await flushUntil(() => lastFrame()?.includes("[Tab] Focus Key Field") ?? false);

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(" ");
    await flushUntil(
      () =>
        lastFrame()?.includes(
          "FOOTER [↑/↓] Navigate [Space] Select Method [Enter] Confirm | [Esc] Close",
        ) ?? false,
    );
  });

  test("advertises only the accelerators an unconfigured product can run", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <FooterProbe />
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    for (let step = 0; step < 3; step += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }
    await flushUntil(() => lastFrame()?.includes("[ Configure ]") ?? false);
    await flushUntil(
      () => lastFrame()?.includes("FOOTER [Esc] Back [Enter] Configure [e] Edit |") ?? false,
    );

    // e reaches Configure: setup is the same key whether it creates or updates.
    stdin.write("e");
    await flushUntil(() => lastFrame()?.includes("Create Configuration") ?? false);
    expect(lastFrame()).toContain("Create Configuration");
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
    // Enter in the list runs the row's primary, Configure.
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Create Configuration") ?? false);
    // Consent is on record, so no acceptance stands between the key and the save.
    expect(lastFrame()).not.toContain("I accept");
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

  test("keeps the panes answering keys when the post-create refetch misses the new configuration", async () => {
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(
        makeConfigurationListResponse(
          makeConfigurationInitResponse([configurationStatus(GEMINI_CONFIGURATION, "ready")]),
        ),
      );
    const createConfiguration = vi.fn<BoundApi["createConfiguration"]>().mockResolvedValue({
      action: "create",
      status: "succeeded",
      configuration: OPENROUTER_CONFIGURATION,
    });
    const api = { ...makeApi(), listConfigurations, createConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    await flushUntil(() => {
      if (lastFrame()?.includes("Product       : openrouter")) return true;
      stdin.write(ARROW_DOWN);
      return false;
    });
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("Create Configuration") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write("sk-openrouter-test");
    await flush();
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => createConfiguration.mock.calls.length === 1);
    await flushUntil(() => !(lastFrame()?.includes("Create Configuration") ?? true));
    expect(lastFrame()).not.toContain("Select Model");

    stdin.write(ARROW_UP);
    await flushUntil(() => lastFrame()?.includes("Product       : zai") ?? false);
    expect(lastFrame()).toContain("Product       : zai");
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
    stdin.write("m");
    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    stdin.write("?");
    await flush();

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("route:settings/providers");
  });

  test("keeps the accelerators quiet while the More menu owns the keys, and closes it on Escape", async () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>();
    const api = { ...makeApi(), testConfiguration } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => lastFrame()?.includes("More actions — Google Gemini") ?? false);
    stdin.write("\u001b");
    await flushUntil(() => !(lastFrame()?.includes("More actions") ?? true));

    expect(testConfiguration).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("[ Change model ]");
  });
});
