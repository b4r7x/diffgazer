import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { ProvidersPage } from "./page";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-keyboard-test" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

/** The audited state: the only configured provider still awaits its conformance check. */
function createPendingOnlyApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeConfigurationInitResponse([
    configurationStatus(GEMINI_CONFIGURATION, "conformance-pending"),
  ]);
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...createConfigurationActionMocks(),
  } satisfies BoundApi;
}

/** The degraded state: init failed, the setup surface renders behind the inline notice. */
function createFailingInitApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockRejectedValue(new Error("init unavailable")),
    listConfigurations: vi.fn().mockRejectedValue(new Error("init unavailable")),
    ...createConfigurationActionMocks(),
  } satisfies BoundApi;
}

function renderProvidersPage(api: BoundApi = createPendingOnlyApi()) {
  const { Wrapper } = createTestQueryWrapper({ api });
  return render(
    <Wrapper>
      <FooterProvider>
        <KeyboardProvider>
          <ConfigProvider>
            <ProviderConsentProvider>
              <ProvidersPage />
            </ProviderConsentProvider>
          </ConfigProvider>
        </KeyboardProvider>
      </FooterProvider>
    </Wrapper>,
  );
}

describe("ProvidersPage filter keyboard path", () => {
  beforeEach(() => {
    clearScopedRouteState("/providers-page-keyboard-test", "providerId");
  });

  it("keeps a pending provider under Configured and moves focus into the list on ArrowDown", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    const configuredFilter = screen.getByRole("radio", { name: "Configured" });
    await user.click(configuredFilter);
    expect(configuredFilter).toHaveFocus();

    expect(screen.getByRole("option", { name: "Google Gemini" })).toBeInTheDocument();
    expect(screen.queryByText("No providers match your filters")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus();
    expect(screen.getByRole("option", { name: "Google Gemini" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("ProvidersPage degraded-notice keyboard path", () => {
  beforeEach(() => {
    clearScopedRouteState("/providers-page-keyboard-test", "providerId");
  });

  it("walks real focus from the providers list up into the notice's Retry and back to search", async () => {
    const user = userEvent.setup();
    renderProvidersPage(createFailingInitApi());

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    const retry = screen.getByRole("button", { name: "Retry" });

    // Up from the list's first row hands off to the filter row...
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "All" })).toHaveFocus();

    // ...up again reaches the search box...
    await user.keyboard("{ArrowUp}");
    const searchInput = screen.getByRole("searchbox", { name: "Search providers" });
    expect(searchInput).toHaveFocus();

    // ...and up once more enters the notice's Retry action.
    await user.keyboard("{ArrowUp}");
    expect(retry).toHaveFocus();

    // Down returns to search, so the notice never traps the cycle.
    await user.keyboard("{ArrowDown}");
    expect(searchInput).toHaveFocus();
  });
});
