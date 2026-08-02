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
import { expectSingleReticle } from "@/testing/reticle";
import {
  makeShellApiOverrides,
  makeShellInitResponse,
  selectedProductId,
} from "@/testing/shell-fixtures";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/settings" }),
}));

import { SettingsHubPage } from "./page";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "dark",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

const shellInit = makeShellInitResponse({
  settings: SETTINGS_FIXTURE,
  project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
});

let mockGetSettings: Mock<BoundApi["getSettings"]>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    ...makeShellApiOverrides(shellInit),
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
    localStorage.clear();
  });

  it("names the panel region with the corner-label heading, announced once", async () => {
    renderPage();

    expect(await screen.findByRole("region", { name: /settings hub/i })).toBeInTheDocument();

    const cornerLabel = screen.getByText("Settings Hub");
    expect(cornerLabel).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("heading", { level: 1, name: "Settings Hub" })).toBe(cornerLabel);

    await waitFor(() => {
      expect(screen.getByText("local settings")).toBeVisible();
    });
    expect(screen.getByText("project path: /tmp/repo")).toBeVisible();
  });

  it("brackets exactly one pane on the loaded screen", async () => {
    const { container } = renderPage();

    await screen.findByRole("region", { name: /settings hub/i });
    await waitFor(() => {
      expect(screen.getByText("local settings")).toBeVisible();
    });

    expectSingleReticle(container);
  });

  it("shows the settings load error in the footer instead of the default message", async () => {
    mockGetSettings = vi
      .fn<BoundApi["getSettings"]>()
      .mockRejectedValue(new Error("settings unavailable"));
    renderPage();

    expect(await screen.findByText("settings unavailable")).toBeVisible();
    expect(screen.queryByText("local settings")).not.toBeInTheDocument();
  });

  it("names the persistent settings menu so it is not an unlabeled role=menu", async () => {
    renderPage();
    expect(await screen.findByRole("menu", { name: /settings/i })).toBeInTheDocument();
  });

  it("navigates to the selected settings section", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("menuitem", { name: /trust & permissions/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings/trust-permissions" });
  });

  it("shows the trusted state when the repository grants repository access", async () => {
    const trustedInit = makeShellInitResponse({
      settings: SETTINGS_FIXTURE,
      project: {
        projectId: "proj-1",
        path: "/tmp/repo",
        trust: {
          projectId: "proj-1",
          repoRoot: "/tmp/repo",
          trustedAt: "2026-01-01T00:00:00.000Z",
          trustMode: "persistent",
          capabilities: { readFiles: true, runCommands: false },
        },
      },
    });
    const api = createTestApi();
    Object.assign(api, makeShellApiOverrides(trustedInit));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>
                  <SettingsHubPage />
                </KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Trusted");
      expect(trustRow).not.toHaveTextContent("Not trusted");
    });
  });

  it("shows not trusted when repository access belongs to the previous root", async () => {
    const movedInit = makeShellInitResponse({
      settings: SETTINGS_FIXTURE,
      project: {
        projectId: "proj-1",
        path: "/tmp/moved-repo",
        trust: {
          projectId: "proj-1",
          repoRoot: "/tmp/repo",
          trustedAt: "2026-01-01T00:00:00.000Z",
          trustMode: "persistent",
          capabilities: { readFiles: true, runCommands: false },
        },
      },
    });
    const api = createTestApi();
    Object.assign(api, makeShellApiOverrides(movedInit));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>
                  <SettingsHubPage />
                </KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Not trusted");
    });
  });

  it("preserves trusted init data when configuration init keeps working", async () => {
    const trustedInit = makeShellInitResponse({
      settings: SETTINGS_FIXTURE,
      project: {
        projectId: "proj-1",
        path: "/tmp/repo",
        trust: {
          projectId: "proj-1",
          repoRoot: "/tmp/repo",
          trustedAt: "2026-01-01T00:00:00.000Z",
          trustMode: "persistent",
          capabilities: { readFiles: true, runCommands: false },
        },
      },
    });
    const api = createTestApi();
    Object.assign(api, makeShellApiOverrides(trustedInit));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>
                  <SettingsHubPage />
                </KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Trusted");
      expect(trustRow).not.toHaveTextContent("Not trusted");
    });
    expect(screen.getByRole("menuitem", { name: /provider/i })).toHaveTextContent(
      selectedProductId(trustedInit) ?? "Not configured",
    );
  });

  it("shows an init error instead of false settings defaults", async () => {
    const api = createTestApi();
    vi.mocked(api.loadConfigurationInit).mockRejectedValue(new Error("init unavailable"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>
                  <SettingsHubPage />
                </KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration unavailable.");
    expect(screen.queryByText("Not trusted")).not.toBeInTheDocument();
    expect(screen.queryByText("Not configured")).not.toBeInTheDocument();
  });

  it("renders no legacy provider status fields in the hub tree", async () => {
    const { container } = renderPage();
    await screen.findByRole("region", { name: /settings hub/i });
    expect(container.innerHTML).toBeClientSafeDom();
  });
});
