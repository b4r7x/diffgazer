import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider, configQueries } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse, TrustConfig } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { TrustPermissionsPage } from "./page";

const TRUSTED_FIXTURE: TrustConfig = {
  projectId: "project-1",
  repoRoot: "/repo",
  trustedAt: "2026-02-09T12:00:00.000Z",
  trustMode: "persistent",
  capabilities: { readFiles: true, runCommands: false },
};

function makeInitResponse(trust: TrustConfig | null = null): InitResponse {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    configured: true,
    project: { projectId: "project-1", path: "/repo", trust },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: trust !== null,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockSaveTrust: Mock<BoundApi["saveTrust"]>;
let mockDeleteTrust: Mock<BoundApi["deleteTrust"]>;
let queryClient: QueryClient;
let testApi: BoundApi;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
    saveTrust: mockSaveTrust,
    deleteTrust: mockDeleteTrust,
  } satisfies BoundApi;
}

function renderPage() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  testApi = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={testApi}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>{children}</KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(
    <>
      <TrustPermissionsPage />
      <Toaster />
    </>,
    { wrapper: Wrapper },
  );
}

async function refetchInit() {
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: configQueries.all() });
  });
}

async function waitForConfigReady() {
  await waitFor(() => {
    expect(screen.getByText("/repo")).toBeInTheDocument();
  });
}

describe("TrustPermissionsPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse(null));
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: true, isActive: true }]);
    mockSaveTrust = vi.fn<BoundApi["saveTrust"]>().mockResolvedValue({ trust: TRUSTED_FIXTURE });
    mockDeleteTrust = vi.fn<BoundApi["deleteTrust"]>().mockResolvedValue({ removed: true });
  });

  it("resets the draft when async trust data arrives", async () => {
    renderPage();
    await waitForConfigReady();

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    mockLoadInit.mockResolvedValue(makeInitResponse(TRUSTED_FIXTURE));
    await refetchInit();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  });

  it("does not steal focus from the action row when async trust data arrives", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForConfigReady();

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus(),
    );
    await user.keyboard("{ArrowDown}");
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toHaveFocus();

    const updatedFixture: TrustConfig = {
      ...TRUSTED_FIXTURE,
      capabilities: { readFiles: false, runCommands: false },
    };
    mockLoadInit.mockResolvedValue(makeInitResponse(updatedFixture));
    await refetchInit();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
    expect(saveButton).toHaveFocus();
  });

  it("focuses the permissions list on entry so arrows work before mouse interaction", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForConfigReady();

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(readFilesOption).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: /save changes/i })).toHaveFocus();
  });

  it("navigates back on Escape", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForConfigReady();

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("saves edited trust permissions and returns to settings", async () => {
    const user = userEvent.setup();
    mockLoadInit.mockResolvedValue(makeInitResponse(TRUSTED_FIXTURE));
    renderPage();
    await waitForConfigReady();

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(readFilesOption).toHaveFocus());
    await waitFor(() => expect(readFilesOption).toHaveAttribute("aria-checked", "true"));

    await user.keyboard(" ");
    expect(readFilesOption).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(mockSaveTrust).toHaveBeenCalledWith({
        capabilities: { readFiles: false },
        trustMode: "persistent",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("revokes trust for the current project from the action row", async () => {
    const user = userEvent.setup();
    mockLoadInit.mockResolvedValue(makeInitResponse(TRUSTED_FIXTURE));
    renderPage();
    await waitForConfigReady();

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus(),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");

    await waitFor(() => expect(mockDeleteTrust).toHaveBeenCalledWith());
    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("surfaces a save failure as an error toast and keeps the user on the page", async () => {
    const user = userEvent.setup();
    mockLoadInit.mockResolvedValue(makeInitResponse(TRUSTED_FIXTURE));
    mockSaveTrust.mockRejectedValue(new Error("Disk full"));

    renderPage();
    await waitForConfigReady();

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(readFilesOption).toHaveFocus());
    await waitFor(() => expect(readFilesOption).toHaveAttribute("aria-checked", "true"));

    await user.keyboard(" {ArrowDown}{Enter}");

    expect(await screen.findByText("Disk full")).toBeVisible();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("surfaces a revoke failure as an error toast and keeps trust state intact", async () => {
    const user = userEvent.setup();
    mockLoadInit.mockResolvedValue(makeInitResponse(TRUSTED_FIXTURE));
    mockDeleteTrust.mockRejectedValue(new Error("Network down"));

    renderPage();
    await waitForConfigReady();

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus(),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");

    expect(await screen.findByText("Network down")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
