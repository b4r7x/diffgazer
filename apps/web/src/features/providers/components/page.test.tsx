import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
} from "@diffgazer/core/schemas/config";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import {
  CLI_UNSUPPORTED_CONFIGURATION,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  READY_GEMINI_CONFIGURATION,
  REMOVED_ZAI_CODING_CONFIGURATION,
} from "@/testing/configuration-fixtures";
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

  it("prevents removed-record selection", async () => {
    renderProvidersPage();

    await waitFor(() => expect(screen.getByText("Z.AI Coding Plan")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Z.AI Coding Plan" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
