import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/testing";
import type { TrustConfig } from "@diffgazer/core/schemas/config";

const { mockNavigate, mockSaveTrust, mockDeleteTrust, mockConfigData } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveTrust: vi.fn(),
  mockDeleteTrust: vi.fn(),
  mockConfigData: {
    projectId: "project-1",
    repoRoot: "/repo",
    trust: null as TrustConfig | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// ConfigProvider requires QueryClientProvider + multiple API hooks (useInit,
// useProviderStatus, etc.) and the test mutates mockConfigData between rerenders
// to simulate async trust arrival — a pattern that's impractical to reproduce
// through the real provider's query lifecycle. Mocking at this context boundary
// keeps the async-data-arrival tests readable.
vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => mockConfigData,
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useSaveTrust: () => ({
    isPending: false,
    mutateAsync: mockSaveTrust,
  }),
  useDeleteTrust: () => ({
    isPending: false,
    mutateAsync: mockDeleteTrust,
  }),
}));

import { TrustPermissionsPage } from "./page";

function renderPage() {
  return renderWithProviders(<TrustPermissionsPage />);
}

describe("TrustPermissionsPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSaveTrust.mockReset();
    mockDeleteTrust.mockReset();
    mockSaveTrust.mockResolvedValue(undefined);
    mockDeleteTrust.mockResolvedValue(undefined);
    mockConfigData.projectId = "project-1";
    mockConfigData.repoRoot = "/repo";
    mockConfigData.trust = null;
  });

  it("resets the draft when async trust data arrives", async () => {
    const { rerender } = renderPage();

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "false");

    mockConfigData.trust = {
      projectId: "project-1",
      repoRoot: "/repo",
      trustedAt: "2026-02-09T12:00:00.000Z",
      trustMode: "persistent",
      capabilities: { readFiles: true, runCommands: false },
    };

    rerender(<TrustPermissionsPage />);

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "true");
  });

  it("does not steal focus from the action row when async trust data arrives", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPage();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toHaveFocus();

    mockConfigData.trust = {
      projectId: "project-1",
      repoRoot: "/repo",
      trustedAt: "2026-02-09T12:00:00.000Z",
      trustMode: "persistent",
      capabilities: { readFiles: false, runCommands: false },
    };

    rerender(<TrustPermissionsPage />);

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "false");
    expect(saveButton).toHaveFocus();
  });

  it("focuses the permissions list on entry so arrows work before mouse interaction", async () => {
    const user = userEvent.setup();
    renderPage();

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(readFilesOption).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: /save changes/i })).toHaveFocus();
  });

  it("navigates back on Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus());
    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("saves edited trust permissions and returns to settings", async () => {
    const user = userEvent.setup();
    mockConfigData.trust = {
      projectId: "project-1",
      repoRoot: "/repo",
      trustedAt: "2026-02-09T12:00:00.000Z",
      trustMode: "persistent",
      capabilities: { readFiles: true, runCommands: false },
    };

    renderPage();

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(readFilesOption).toHaveFocus());

    await user.keyboard(" ");
    expect(readFilesOption).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(mockSaveTrust).toHaveBeenCalledWith({
        projectId: "project-1",
        repoRoot: "/repo",
        capabilities: { readFiles: false, runCommands: false },
        trustMode: "persistent",
        trustedAt: expect.any(String),
      });
    });
    expect(new Date(mockSaveTrust.mock.calls[0][0].trustedAt).toISOString()).toBe(
      mockSaveTrust.mock.calls[0][0].trustedAt,
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("revokes trust for the current project from the action row", async () => {
    const user = userEvent.setup();
    mockConfigData.trust = {
      projectId: "project-1",
      repoRoot: "/repo",
      trustedAt: "2026-02-09T12:00:00.000Z",
      trustMode: "persistent",
      capabilities: { readFiles: true, runCommands: false },
    };

    renderPage();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveFocus());
    await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");

    await waitFor(() => expect(mockDeleteTrust).toHaveBeenCalledWith("project-1"));
    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "false");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
