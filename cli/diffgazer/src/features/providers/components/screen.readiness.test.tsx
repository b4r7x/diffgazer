import type { BoundApi } from "@diffgazer/core/api";
import { PRODUCT_REGISTRY, UNRECOGNIZED_CONFIGURATION_COPY } from "@diffgazer/core/providers";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import {
  DEFAULT_SETTINGS,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  PROVIDER_CONSENT_TEXT,
} from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeAllConfigurationsListResponse,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
  OPENROUTER_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { cleanupRootFrames } from "../../../testing/render-root-frame";
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_UP,
  ENTER,
  ESCAPE,
  FooterProbe,
  flushUntil,
  makeApi,
  TAB,
  Wrapper,
} from "../testing/screen-harness";
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

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("ProvidersScreen V2 products and readiness", () => {
  test("opens with the first product row already in the details pane", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Product       : ollama-cloud") ?? false);
    expect(lastFrame()).not.toContain("Select a provider to view details");

    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    // The pane names the configured model in full: catalog name, then the id a review pins.
    await flushUntil(() => lastFrame()?.includes("Gemini 2.5 Flash · gemini-2.5-flash") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Google Gemini");
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
    expect(lastFrame()).toContain("Z.AI");

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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it, and
    // the pane's full model line confirms the move.
    stdin.write(ARROW_UP);
    await flushUntil(() => lastFrame()?.includes("Gemini 2.5 Flash · gemini-2.5-flash") ?? false);
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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);

    // Enter in the list runs the highlighted row's primary, Select configuration,
    // and the footer says so; the notice stands between the key and the send.
    await flushUntil(
      () =>
        lastFrame()?.includes(
          "FOOTER [Esc] Back [Enter] Select configuration [m] Model [e] Edit [v] Verify [d] Delete [c] Review |",
        ) ?? false,
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
