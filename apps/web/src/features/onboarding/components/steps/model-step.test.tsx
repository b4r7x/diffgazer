import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { getInitialWizardData } from "@diffgazer/core/onboarding";
import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeReadiness, READY_GEMINI_CONFIGURATION } from "@/testing/configuration-fixtures";
import { ModelStep } from "./model-step";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

const GEMINI_CONFIGURATION = READY_GEMINI_CONFIGURATION as SupportedConfigurationSummary;

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ModelStep", () => {
  it("lists configuration-bound exact models from the selected product policy", () => {
    const gemini = getInitialWizardData("gemini");
    render(
      <ModelStep
        configurationInput={gemini.configurationInput}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /model id/i })).not.toBeInTheDocument();
  });

  it("announces configuration-bound discovery failures and retries without manual entry", async () => {
    const user = userEvent.setup();
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValue({
        action: "test",
        status: "succeeded",
        configuration: GEMINI_CONFIGURATION,
        readiness: makeReadiness("ready", "gemini"),
      });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const gemini = getInitialWizardData("gemini");

    render(
      <ModelStep
        configurationInput={gemini.configurationInput}
        discoveryConfiguration={GEMINI_CONFIGURATION}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /catalog unavailable|Model discovery failed/i,
    );
    expect(screen.queryByRole("textbox", { name: "Model ID" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await vi.waitFor(() => expect(testConfiguration).toHaveBeenCalledTimes(2));
  });

  it("focuses retry when configuration-bound discovery recovers to an error", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockReturnValue(new Promise(() => {}));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const gemini = getInitialWizardData("gemini");

    render(
      <ModelStep
        configurationInput={gemini.configurationInput}
        discoveryConfiguration={GEMINI_CONFIGURATION}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );

    expect(screen.getByRole("status")).toHaveTextContent(/discovering models/i);
  });

  it("commits the selected exact model when Enter is pressed", async () => {
    const gemini = getInitialWizardData("gemini");
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ModelStep
        configurationInput={gemini.configurationInput}
        value="gemini-2.5-flash"
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    const modelGroup = screen.getByRole("radiogroup", { name: /available models/i });
    const selectedRadio = within(modelGroup).getByRole("radio", {
      name: /gemini-2\.5-flash/i,
    });
    selectedRadio.focus();
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledWith("gemini-2.5-flash");
  });

  it("shows skipped discovery remediation without exposing catalog-only models", async () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "succeeded",
      configuration: { ...GEMINI_CONFIGURATION, selectedModelId: null },
      readiness: makeReadiness("skipped", "gemini"),
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const gemini = getInitialWizardData("gemini");

    render(
      <ModelStep
        configurationInput={gemini.configurationInput}
        discoveryConfiguration={GEMINI_CONFIGURATION}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );

    expect(await screen.findByText(/live-check prerequisites/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("covers hosted, local HTTP, and local CLI policy model rows", () => {
    const hosted = getInitialWizardData("deepseek");
    const { rerender } = render(
      <ModelStep
        configurationInput={hosted.configurationInput}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /deepseek-v4-flash/i })).toBeInTheDocument();

    const localHttp = getInitialWizardData("local-openai");
    rerender(
      <ModelStep
        configurationInput={localHttp.configurationInput}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /local-model/i })).toBeInTheDocument();

    const localCli = getInitialWizardData("codex-cli");
    rerender(
      <ModelStep
        configurationInput={localCli.configurationInput}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /gpt-5-codex/i })).toBeInTheDocument();
  });
});
