import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ThemeProvider } from "@/hooks/use-theme";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/settings" }),
}));

import { SettingsHubPage } from "./page";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "auto",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

function makeInitResponse(): Awaited<ReturnType<BoundApi["loadInit"]>> {
  return {
    config: { provider: "openrouter", model: "openrouter/test-model" },
    providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
    settings: SETTINGS_FIXTURE,
    configured: true,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

let mockGetSettings: Mock<BoundApi["getSettings"]>;
let mockLoadInit: Mock<BoundApi["loadInit"]>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    loadInit: mockLoadInit,
  } satisfies BoundApi;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>{children}</KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<SettingsHubPage />, { wrapper: Wrapper });
}

describe("SettingsHubPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    localStorage.clear();
  });

  it("exposes the panel as a region named Settings Hub without double-announcing the corner label", async () => {
    renderPage();

    expect(screen.getByRole("region", { name: /settings hub/i })).toBeInTheDocument();

    // getByText throws on multiple matches, so this also proves "Settings Hub" appears once.
    const cornerLabel = screen.getByText("Settings Hub");
    expect(cornerLabel).toHaveAttribute("aria-hidden", "true");

    await waitFor(() => {
      expect(screen.getByText("local settings")).toBeVisible();
    });
  });

  it("shows the settings load error in the footer instead of the default message", async () => {
    mockGetSettings = vi
      .fn<BoundApi["getSettings"]>()
      .mockRejectedValue(new Error("settings unavailable"));
    renderPage();

    expect(await screen.findByText("settings unavailable")).toBeVisible();
    expect(screen.queryByText("local settings")).not.toBeInTheDocument();
  });

  it("names the persistent settings menu so it is not an unlabeled role=menu", () => {
    renderPage();
    expect(screen.getByRole("menu", { name: /settings/i })).toBeInTheDocument();
  });

  it("navigates to the selected settings section", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("menuitem", { name: /trust & permissions/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings/trust-permissions" });
  });

  it("shows the trusted state when the repository grants repository access", async () => {
    const trustedInit = makeInitResponse();
    trustedInit.project = {
      ...trustedInit.project,
      trust: {
        projectId: "proj-1",
        repoRoot: "/tmp/repo",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent",
        capabilities: { readFiles: true, runCommands: false },
      },
    };
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(trustedInit);
    renderPage();

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Trusted");
      expect(trustRow).not.toHaveTextContent("Not trusted");
    });
  });
});
