import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  Readiness,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  makeReadiness,
  READINESS_PRESENTATION,
  READY_GEMINI_CONFIGURATION,
} from "@/testing/configuration-fixtures";
import { ModelSelectDialog } from "./dialog";

const _CHECKED_AT = "2026-07-31T12:00:00.000Z";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;
type TestConfigurationResponse = Extract<ClientConfigurationActionResponse, { action: "test" }>;

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function readyFor(productId: RunnableProductId): Extract<Readiness, { status: "ready" }> {
  return makeReadiness("ready", productId) as Extract<Readiness, { status: "ready" }>;
}

function testDiscoveryResponse(
  configuration: SupportedConfigurationSummary,
  modelId = configuration.selectedModelId ?? "gemini-2.5-flash",
  readiness: Readiness = readyFor(configuration.productId),
  status: TestConfigurationResponse["status"] = "succeeded",
): TestConfigurationResponse {
  return {
    action: "test",
    status,
    configuration: { ...configuration, selectedModelId: modelId },
    readiness,
  };
}

const DISCOVERED_MODEL_ID = "gemini-2.5-flash";

interface RenderOptions {
  configuration?: SupportedConfigurationSummary;
  currentModel?: string | null;
  isSaving?: boolean;
  onSelect?: (modelId: string) => void;
  onOpenChange?: (open: boolean) => void;
  testConfiguration?: BoundApi["testConfiguration"];
}

function renderDialog(options: RenderOptions = {}) {
  const testConfiguration =
    options.testConfiguration ??
    vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(
        testDiscoveryResponse(
          (options.configuration ?? READY_GEMINI_CONFIGURATION) as SupportedConfigurationSummary,
          DISCOVERED_MODEL_ID,
        ),
      );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    testConfiguration,
  } satisfies BoundApi;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
  const onSelect = options.onSelect ?? vi.fn();
  const onOpenChange = options.onOpenChange ?? vi.fn();
  const currentModel =
    options.currentModel === null ? undefined : (options.currentModel ?? "gemini-2.5-flash");

  function DialogHarness() {
    const [open, setOpen] = useState(true);

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange(nextOpen);
    };

    return (
      <ModelSelectDialog
        open={open}
        onOpenChange={handleOpenChange}
        configuration={
          (options.configuration ?? READY_GEMINI_CONFIGURATION) as SupportedConfigurationSummary
        }
        currentModel={currentModel}
        isSaving={options.isSaving}
        onSelect={onSelect}
      />
    );
  }

  render(<DialogHarness />, { wrapper });
  return { testConfiguration, onSelect, onOpenChange };
}

describe("ModelSelectDialog configuration-bound discovery", () => {
  it("keeps the footer actions accessible when keyboard-only hints are capability-gated", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(within(dialog).getByText("Search")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("renders the exact discovered model ID without catalog-only availability", async () => {
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );
    const modelList = screen.getByRole("radiogroup", { name: /available models/i });
    expect(within(modelList).getAllByRole("radio")).toHaveLength(1);
    expect(screen.queryByText(/using cached catalog data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/structured outputs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/latest/i)).not.toBeInTheDocument();
  });

  it("narrows to an empty list when the tier filter excludes the admitted model", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );

    const filterTabs = screen.getByRole("radiogroup", { name: /model tier filter/i });
    await user.click(within(filterTabs).getByRole("radio", { name: /^free$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("radio", { name: /gemini-2\.5-flash/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/no models match your search/i);
  });

  it("pre-checks the current exact model when the dialog opens", async () => {
    renderDialog({ currentModel: DISCOVERED_MODEL_ID });
    const checkedRadio = await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(checkedRadio).toBeChecked();
  });

  it("fires onSelect with the exact configuration model ID when confirmed", async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = renderDialog({ currentModel: DISCOVERED_MODEL_ID });
    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith(DISCOVERED_MODEL_ID);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a saving state and disables confirmation while persistence is pending", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ currentModel: "gemini-2.5-flash", isSaving: true });

    const dialog = await screen.findByRole("dialog");
    const savingButton = await waitFor(() =>
      within(dialog).getByRole("button", { name: /^saving/i }),
    );

    expect(savingButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /close dialog/i })).toBeDisabled();

    await user.keyboard("{Escape}");
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    // fireEvent retained: outside-click dismissal needs exact client coordinates vs dialog bounds.
    fireEvent.pointerDown(dialog, { clientX: -1, clientY: -1 });
    // fireEvent retained: outside-click dismissal needs exact client coordinates vs dialog bounds.
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });
});

describe("ModelSelectDialog discovery states", () => {
  it("shows skipped remediation with checkedAt and retries discovery", async () => {
    const user = userEvent.setup();
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "succeeded",
      configuration: READY_GEMINI_CONFIGURATION,
      readiness: makeReadiness("skipped", "gemini"),
    });
    renderDialog({ testConfiguration });

    const skippedMessage = `${READINESS_PRESENTATION.skipped.explanation} ${READINESS_PRESENTATION.skipped.remediation.message}`;
    const announcements = await screen.findAllByText(skippedMessage);
    expect(announcements.length).toBeGreaterThan(0);
    // One live-region owner: the retry banner repeats the text visually but must
    // not announce it a second time.
    expect(
      announcements.filter((node) => node.closest("[aria-live], [role='status']") !== null),
    ).toHaveLength(1);
    expect(screen.getByText(/checked/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(testConfiguration).toHaveBeenCalledTimes(2));
  });

  it("renders the failed discovery message when the test query rejects", async () => {
    renderDialog({
      testConfiguration: vi
        .fn<BoundApi["testConfiguration"]>()
        .mockRejectedValue(new Error("Catalog unavailable")),
    });
    expect(
      (await screen.findAllByText("Model discovery failed. Test the configuration again.")).length,
    ).toBeGreaterThan(0);
  });

  it("renders the loading state while discovery is pending", async () => {
    renderDialog({
      testConfiguration: vi
        .fn<BoundApi["testConfiguration"]>()
        .mockReturnValue(new Promise<TestConfigurationResponse>(() => {})),
    });
    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();
  });

  it("rejects stale checked models and never falls back to a different exact ID", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderDialog({ currentModel: "stale-model-id", onSelect });

    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(onSelect).not.toHaveBeenCalledWith("stale-model-id");
  });
});

describe("ModelSelectDialog transport model policies", () => {
  it("shows local loopback evidence for local-http configurations", async () => {
    const localConfiguration: SupportedConfigurationSummary = {
      configurationId: "ollama-loopback",
      revision: 2,
      status: "supported",
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
      selectedModelId: "qwen2.5-coder:7b",
      notices: [copyNotice("ollama")],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    };
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(
        testDiscoveryResponse(localConfiguration, "qwen2.5-coder:7b", readyFor("ollama")),
      );
    renderDialog({
      configuration: localConfiguration,
      testConfiguration,
      currentModel: "qwen2.5-coder:7b",
    });

    expect(await screen.findByRole("radio", { name: /qwen2\.5-coder:7b/ })).toBeInTheDocument();
    expect(screen.getByText(/ollama/i)).toBeInTheDocument();
    expect(screen.queryByText(/structured outputs/i)).not.toBeInTheDocument();
  });
});
