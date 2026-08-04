import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import {
  configurationStatus,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  READY_GEMINI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { ProvidersPage } from "./page";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-keyboard-test" }),
  useNavigate: () => vi.fn(),
}));

/** The audited state: the only configured provider still awaits its conformance check. */
function createPendingOnlyApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeConfigurationInitResponse([
    configurationStatus(READY_GEMINI_CONFIGURATION, "conformance-pending"),
  ]);
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...createConfigurationActionMocks(),
  } satisfies BoundApi;
}

function renderProvidersPage() {
  const { Wrapper } = createTestQueryWrapper({ api: createPendingOnlyApi() });
  return render(
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
