import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { UNRECOGNIZED_CONFIGURATION_COPY } from "@diffgazer/core/providers";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
} from "@diffgazer/core/schemas/config";
import {
  CODEX_CLI_CONFIGURATION,
  configurationStatus,
  GEMINI_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { ProvidersPage } from "./page";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

function makeInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse([
    configurationStatus(GEMINI_CONFIGURATION, "ready"),
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-conformance-failed"),
    configurationStatus(CODEX_CLI_CONFIGURATION, "unsupported"),
  ]);
}

beforeAll(() => {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
});

let mockApi: ReturnType<typeof createMockApi>;

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeInitResponse();
  const actionMocks = createConfigurationActionMocks();
  vi.mocked(actionMocks.createConfiguration).mockResolvedValue(
    ClientConfigurationActionResponseSchema.parse({
      action: "create",
      status: "succeeded",
      configuration: LOCAL_OPENAI_CONFIGURATION,
    }) as Awaited<ReturnType<BoundApi["createConfiguration"]>>,
  );
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...actionMocks,
  } satisfies BoundApi;
}

// The layout attribute is the handle the responsive-contracts e2e already
// locates the panes by; data-state="focused" is Panel's documented bracket
// contract.
function getPane(container: HTMLElement, pane: "provider-list" | "provider-details"): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-layout-pane="${pane}"]`);
  if (!element) throw new Error(`Missing provider pane: ${pane}`);
  return element;
}

function renderProvidersPage() {
  const { Wrapper, queryClient } = createTestQueryWrapper({ api: mockApi });
  const view = render(
    <Wrapper>
      <FooterProvider>
        <KeyboardProvider>
          <ConfigProvider>
            <ProvidersPage />
          </ConfigProvider>
        </KeyboardProvider>
      </FooterProvider>
    </Wrapper>,
  );
  return { ...view, queryClient };
}

describe("ProvidersPage", () => {
  beforeEach(() => {
    mockApi = createMockApi();
    clearScopedRouteState("/providers-page-test", "providerId");
    vi.clearAllMocks();
  });

  it("keeps the provider setup surface interactive behind an inline notice when init fails", async () => {
    mockApi.loadConfigurationInit.mockRejectedValue(new Error("init unavailable"));

    const { container } = renderProvidersPage();

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // The catalog does not depend on the broken configuration: the recovery
    // screen keeps every product reachable so credentials can be re-entered.
    expect(screen.getByRole("listbox", { name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Google Gemini/ })).toBeInTheDocument();
    expect(screen.queryByText("Loading providers...")).not.toBeInTheDocument();
    // The notice sits directly above the panes container in the same page flow,
    // so on narrow viewports it scrolls away with the content instead of
    // pinning above the page's scroller.
    expect(notice.nextElementSibling).toContainElement(getPane(container, "provider-list"));
  });

  it("names the session mismatch in the inline notice when init is unauthorized", async () => {
    mockApi.loadConfigurationInit.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" }),
    );

    renderProvidersPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Session Not Authorized");
    expect(screen.getByRole("listbox", { name: "Providers" })).toBeInTheDocument();
  });

  it("shows no configuration notice when init succeeds", async () => {
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("completes local setup routing without exposing credential inputs", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Google Gemini" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("option", { name: /Local OpenAI-compatible/i }));
    await user.click(screen.getByRole("button", { name: /Update configuration/i }));

    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sk-/)).not.toBeInTheDocument();
  });

  it("shows CLI unsupported evidence in the provider list", async () => {
    renderProvidersPage();

    await waitFor(() => expect(screen.getByLabelText(/CLI unsupported/i)).toBeInTheDocument());
  });

  it("preserves keyboard flow into enabled actions", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
  });

  it("moves the focus brackets between the list and details panes", async () => {
    const user = userEvent.setup();
    const { container } = renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    expect(getPane(container, "provider-list")).toHaveAttribute("data-state", "focused");
    expect(getPane(container, "provider-details")).not.toHaveAttribute("data-state");

    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
    expect(getPane(container, "provider-details")).toHaveAttribute("data-state", "focused");
    expect(getPane(container, "provider-list")).not.toHaveAttribute("data-state");
  });

  it("rests both panes once focus leaves them", async () => {
    const user = userEvent.setup();
    const { container } = renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    await user.click(document.body);

    expect(listbox).not.toHaveFocus();
    expect(getPane(container, "provider-list")).not.toHaveAttribute("data-state");
    expect(getPane(container, "provider-details")).not.toHaveAttribute("data-state");
  });

  // Retiring a product turns its stored record into bytes this build cannot
  // decode. The row exists so that record does not become permanent: it names
  // itself honestly, offers removal and nothing else, and the delete asserts no
  // revision because the list never showed one.
  it("offers only removal for a stored record this build could not decode", async () => {
    const user = userEvent.setup();
    const init = makeConfigurationInitResponse(
      [configurationStatus(GEMINI_CONFIGURATION, "ready")],
      GEMINI_CONFIGURATION.configurationId,
      [{ configurationId: "cfg-retired" }],
    );
    mockApi.loadConfigurationInit.mockResolvedValue(init);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(init));

    renderProvidersPage();

    await user.click(
      await screen.findByRole("option", { name: UNRECOGNIZED_CONFIGURATION_COPY.label }),
    );

    // Both surfaces render the copy core owns, so neither can describe the same
    // record differently.
    expect(screen.getByText(UNRECOGNIZED_CONFIGURATION_COPY.description)).toBeInTheDocument();
    const actions = screen.getByRole("group", { name: "Provider actions" });
    const buttons = within(actions).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Delete configuration");

    await user.click(within(actions).getByRole("button", { name: "Delete configuration" }));

    await waitFor(() =>
      expect(mockApi.deleteConfiguration).toHaveBeenCalledWith("cfg-retired", undefined),
    );
  });

  it("renders no secret-bearing JSON in the page tree", async () => {
    const { container } = renderProvidersPage();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Google Gemini" })).toBeInTheDocument(),
    );

    const serialized = container.innerHTML;
    expect(serialized).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(serialized).not.toContain("providerStatus");
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toMatch(/"secret"\s*:/);
  });
});
