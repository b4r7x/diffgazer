import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
} from "@diffgazer/core/schemas/config";
import {
  CLI_UNSUPPORTED_CONFIGURATION,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  READY_GEMINI_CONFIGURATION,
  REMOVED_ZAI_CODING_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { ProvidersPage } from "./page";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => vi.fn(),
}));

function makeInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse([
    configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
    configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
    configurationStatus(REMOVED_ZAI_CODING_CONFIGURATION, "removed"),
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

// Both panes are unnamed regions, so the layout attribute the responsive-contracts
// e2e already locates them by is the only handle; data-state="focused" is Panel's
// documented bracket contract.
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

  it("does not render removed records", async () => {
    renderProvidersPage();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Google Gemini" })).toBeInTheDocument(),
    );
    expect(screen.queryByText("Z.AI Coding Plan")).not.toBeInTheDocument();
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
