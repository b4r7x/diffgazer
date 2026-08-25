import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { PROVIDER_CONSENT_TEXT, type SettingsConfig } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GlobalShortcuts } from "@/components/layout/global";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { ThemeProvider } from "@/hooks/use-theme";
import { shutdown } from "@/lib/shutdown";
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

vi.mock("@/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
  reportShutdownResult: vi.fn(),
}));

import { SettingsHubPage } from "./page";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "dark",
  defaultLenses: [],
  effectiveCallTokenCap: 49_152,
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
  providerConsent: null,
};

const shellInit = makeShellInitResponse({
  settings: SETTINGS_FIXTURE,
  project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
});

const trustedShellInit = makeShellInitResponse({
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

let mockGetSettings: Mock<BoundApi["getSettings"]>;

function createTestApi(init = shellInit): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    ...makeShellApiOverrides(init),
  } satisfies BoundApi;
}

/** The one provider stack for this suite; every test renders through it. */
function renderWithProviders(api: BoundApi, { globalShortcuts = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <ThemeProvider>
              <FooterProvider>
                <KeyboardProvider>
                  {globalShortcuts ? <GlobalShortcuts /> : null}
                  <ProviderConsentProvider>{children}</ProviderConsentProvider>
                </KeyboardProvider>
              </FooterProvider>
            </ThemeProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<SettingsHubPage />, { wrapper: Wrapper });
}

function renderPage(init = shellInit, options?: { globalShortcuts?: boolean }) {
  return renderWithProviders(createTestApi(init), options);
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
    expect(screen.getByText(/project path:/)).toBeVisible();
    // The path is middle-truncated for the single-line footer, so the full
    // value lives on the title rather than in the visible text.
    expect(screen.getByTitle("/tmp/repo")).toBeVisible();
  });

  it("keeps the repo path and the settings caption on one footer row", async () => {
    const { container } = renderPage();

    await screen.findByRole("region", { name: /settings hub/i });
    await waitFor(() => {
      expect(screen.getByText("local settings")).toBeVisible();
    });

    const footer = container.querySelector('[data-slot="panel-footer"]');
    const caption = screen.getByText("local settings");
    expect(footer).toContainElement(screen.getByText(/project path:/));
    expect(footer).toContainElement(screen.getByTitle("/tmp/repo"));
    // Both ends are direct children of the one footer row: nothing stacks the
    // caption under a wrapped path.
    expect(caption.parentElement).toBe(footer);
  });

  it("brackets the pane only while the keyboard is inside it", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const region = await screen.findByRole("region", { name: /settings hub/i });
    const menu = await screen.findByRole("menu", { name: /settings/i });

    // The hub menu owns the arrow keys and takes focus on mount, so the pane
    // starts bracketed.
    await waitFor(() => expect(menu).toHaveFocus());
    expect(region.querySelector('[data-slot="panel-corners"]')).not.toBeNull();

    // Clicking away is the resting state this screen used to claim statically.
    await user.click(document.body);
    expect(region.querySelector('[data-slot="panel-corners"]')).toBeNull();

    await user.tab();
    expect(menu).toHaveFocus();
    expect(region.querySelector('[data-slot="panel-corners"]')).not.toBeNull();
    expectSingleReticle(container);
  });

  it("renders TRUSTED as a chip and carries every other affirmative row on tone alone", async () => {
    const { container } = renderPage(trustedShellInit);

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Trusted");
      expect(trustRow).not.toHaveTextContent("Not trusted");
    });

    // A chip rather than prose, so the affirmative state reads at a glance
    // without a glyph. jsdom cannot compute the green fill, so the tone itself
    // stays a screenshot-level contract.
    expect(within(trustRow).getByText("Trusted")).toHaveAttribute("data-slot", "badge");
    expect(container.textContent).not.toContain("✓");
  });

  it("renders init-sourced settings while a redundant settings query is still pending", async () => {
    mockGetSettings = vi
      .fn<BoundApi["getSettings"]>()
      .mockImplementation(() => new Promise(() => {}));
    renderPage();

    const agentExecutionRow = await screen.findByRole("menuitem", { name: /agent execution/i });
    expect(agentExecutionRow).toHaveTextContent("Parallel");
    expect(screen.getByRole("menuitem", { name: /storage/i })).toHaveTextContent("Not set");
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
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
    renderPage(movedInit);

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Not trusted");
    });
  });

  it("carries the trusted row and the selected provider from one init response", async () => {
    renderPage(trustedShellInit);

    const trustRow = await screen.findByRole("menuitem", { name: /trust & permissions/i });
    await waitFor(() => {
      expect(trustRow).toHaveTextContent("Trusted");
      expect(trustRow).not.toHaveTextContent("Not trusted");
    });
    expect(screen.getByRole("menuitem", { name: /^provider\b(?! data)/i })).toHaveTextContent(
      selectedProductId(trustedShellInit) ?? "Not configured",
    );
  });

  it("reads the provider data notice back from the hub without asking again once accepted", async () => {
    const user = userEvent.setup();
    renderPage(
      makeShellInitResponse({
        settings: {
          ...SETTINGS_FIXTURE,
          providerConsent: { version: 1, acceptedAt: "2026-08-18T10:00:00.000Z" },
        },
        project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
      }),
    );

    const row = await screen.findByRole("menuitem", { name: /provider data notice/i });
    expect(row).toHaveTextContent(/Accepted 2026-08-1[89]/);
    await user.click(row);

    const dialog = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    expect(within(dialog).getByText(PROVIDER_CONSENT_TEXT)).toBeInTheDocument();
    expect(within(dialog).getByText(/Accepted 2026-08-1[89]/)).toBeInTheDocument();
    // Read-only once accepted: nothing to accept, only Close, and Close holds
    // the focus so the Enter that opened the row closes it again rather than
    // following the privacy link.
    expect(within(dialog).queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus(),
    );
    // The notice owns the keys while it is up: the hub's Escape (back to home)
    // must not fire underneath it.
    await user.keyboard("{Escape}");
    expect(mockNavigate).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("offers the acceptance from the hub row while no consent is on record", async () => {
    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole("menuitem", { name: /provider data notice/i });
    expect(row).toHaveTextContent("Not accepted");
    await user.click(row);

    const dialog = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    expect(within(dialog).getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("shows an init error instead of false settings defaults", async () => {
    const api = createTestApi();
    vi.mocked(api.loadConfigurationInit).mockRejectedValue(new Error("init unavailable"));
    renderWithProviders(api);

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Not trusted")).not.toBeInTheDocument();
    expect(screen.queryByText("Not configured")).not.toBeInTheDocument();
  });

  // The hub Menu takes focus on mount, so every printable key lands on a list
  // that runs typeahead. No row starts with q, so the miss must leave the event
  // unclaimed and fall through to the window layer that owns quit.
  it("lets q reach the app quit shortcut while the autofocused menu holds focus", async () => {
    const user = userEvent.setup();
    renderPage(shellInit, { globalShortcuts: true });

    const menu = await screen.findByRole("menu", { name: /settings/i });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.keyboard("q");

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("renders no legacy provider status fields in the hub tree", async () => {
    const { container } = renderPage();
    await screen.findByRole("region", { name: /settings hub/i });
    expect(container.innerHTML).toBeClientSafeDom();
  });
});
