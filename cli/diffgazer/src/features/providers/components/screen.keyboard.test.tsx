import type { BoundApi } from "@diffgazer/core/api";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import { READINESS_PRESENTATION } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeAllConfigurationsListResponse,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
  OPENCODE_ZEN_CONFIGURATION,
  OPENROUTER_CONFIGURATION,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GlobalShortcuts } from "../../../app/global-shortcuts";
import { flush } from "../../../testing/flush";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  ENTER,
  FooterProbe,
  flushUntil,
  flushUntilRoot,
  makeApi,
  ProvidersApiBoundary,
  pressRoot,
  RouteProbe,
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

// One row both Zen and Go serve: the only case where the armed pool changes
// what gets saved.
const SHARED_POOL_MODELS_RESPONSE: ConfigurationModelsResponse = {
  status: "passed",
  configurationId: OPENCODE_ZEN_CONFIGURATION.configurationId,
  productId: OPENCODE_ZEN_CONFIGURATION.productId,
  transportFamily: OPENCODE_ZEN_CONFIGURATION.transportFamily,
  models: [
    {
      id: "deepseek-v4-flash",
      name: "deepseek-v4-flash",
      description: "shared route",
      tier: "paid",
      endpointProfileIds: ["zen", "go"],
    },
  ],
  checkedAt: "2026-07-31T12:00:00.000Z",
  source: "snapshot",
  cached: false,
};

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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flushUntil(() => lastFrame()?.includes("[ Change model ]") ?? false);
    for (const key of [ARROW_RIGHT, ARROW_RIGHT, ARROW_LEFT, ARROW_DOWN]) {
      stdin.write(key);
      await flush();
    }
    expect(lastFrame()).toContain("[ Change model ]");
    expect(lastFrame()).not.toContain("[ Configure ]");

    stdin.write(ARROW_LEFT);
    await flush();
    // Down from the last row wraps back to the unconfigured first product.
    stdin.write(ARROW_DOWN);
    await flushUntil(() => lastFrame()?.includes("[ Configure ]") ?? false);

    expect(lastFrame()).toContain("[ Configure ]");
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
    stdin.write("d");
    await flushUntil(() => lastFrame()?.includes("Delete configuration?") ?? false);
    // It opens on Cancel: Enter as it stands keeps the configuration.
    await flushUntil(
      () =>
        lastFrame()?.includes("FOOTER [←/→] Switch Action [Enter] Cancel | [Esc] Cancel") ?? false,
    );
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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // The configured Gemini row is last; wrapping up from the first row lands on
    // it, and the pane's readiness line confirms the move.
    stdin.write(ARROW_UP);
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flushUntil(() => lastFrame()?.includes("[ Select configuration ]") ?? false);
    stdin.write(TAB);
    await flush();
    stdin.write(ENTER);
    await flushUntil(() => selectConfiguration.mock.calls.length === 1);

    expect(selectConfiguration).toHaveBeenCalledWith(
      "gemini-primary",
      readyStatus.configuration.selectedModelId,
      undefined,
    );
  });

  // The overlay emits the endpoint; the screen is the only production call site
  // that can drop it, so the mutation is asserted end to end from `m` + `p`.
  test("carries the pool armed in the model overlay into the select mutation", async () => {
    // Bound to Zen with the shared model already saved: confirming it again on
    // the armed Go pool is the wallet switch, and nothing else changes.
    const zenStatus = configurationStatus(
      { ...OPENCODE_ZEN_CONFIGURATION, selectedModelId: "deepseek-v4-flash" },
      "ready",
    );
    const selectConfiguration = vi.fn<BoundApi["selectConfiguration"]>().mockResolvedValue({
      action: "select",
      status: "succeeded",
      configuration: zenStatus.configuration,
      readiness: zenStatus.readiness,
    });
    const listConfigurations = vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(makeConfigurationListResponse(makeConfigurationInitResponse([zenStatus])));
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(SHARED_POOL_MODELS_RESPONSE);
    const api = {
      ...makeApi(),
      selectConfiguration,
      listConfigurations,
      getConfigurationModels,
    } satisfies BoundApi;
    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("OpenCode · Zen") ?? false);
    // The configured Zen row sits third, behind Ollama Cloud and OpenRouter.
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flushUntil(() => lastFrame()?.includes("Product       : opencode-zen") ?? false);
    stdin.write("m");
    // The details pane already names the saved model, so the overlay's own
    // row is the frame `p` needs: keys sent before it mounts land on the
    // screen, where Enter on the active row does nothing.
    await flushUntil(() => lastFrame()?.includes("[*] deepseek-v4-flash") ?? false);
    stdin.write("p");
    await flushUntil(() => lastFrame()?.includes("Saving moves billing to OpenCode Go.") ?? false);
    stdin.write(ENTER);
    await flushUntil(() => selectConfiguration.mock.calls.length === 1);

    expect(selectConfiguration).toHaveBeenCalledWith(
      "opencode-zen-primary",
      "deepseek-v4-flash",
      "https://opencode.ai/zen/go/v1",
    );
  });

  test("keeps provider rows and action labels on whole lines", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ProvidersScreen />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Google Gemini") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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

    await flushUntilRoot(() => view.lastFrame()?.includes("Ollama Cloud") ?? false);
    // Gemini is the last row; wrapping up from the first row lands on it.
    await pressRoot(view, ARROW_UP);
    await pressRoot(view, ENTER);
    await flushUntilRoot(() => view.lastFrame()?.includes("gemini-2.5-flash") ?? false);
    for (const key of keys) {
      await pressRoot(view, key);
    }
    await flushUntilRoot(() => view.lastFrame()?.includes(title) ?? false);
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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
    // The unconfigured OpenRouter row sits second, behind Ollama Cloud.
    stdin.write("\u001b[B");
    await flushUntil(() => lastFrame()?.includes("Product       : openrouter") ?? false);
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
    await flushUntil(() => lastFrame()?.includes("Product       : ollama-cloud") ?? false);
    expect(lastFrame()).toContain("Product       : ollama-cloud");
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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
    // Gemini is the last row; wrapping up from the first row lands on it.
    stdin.write(ARROW_UP);
    await flush();
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
