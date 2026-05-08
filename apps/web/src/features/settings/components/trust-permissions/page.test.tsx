import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeyboardProvider } from "@diffgazer/keys";
import type { TrustConfig } from "@diffgazer/core/schemas/config";

const { mockNavigate, mockConfigData } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockConfigData: {
    projectId: "project-1",
    repoRoot: "/repo",
    trust: null as TrustConfig | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => mockConfigData,
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useSaveTrust: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useDeleteTrust: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

import { TrustPermissionsPage } from "./page";

function renderPage() {
  return render(
    <KeyboardProvider>
      <TrustPermissionsPage />
    </KeyboardProvider>,
  );
}

describe("TrustPermissionsPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockConfigData.projectId = "project-1";
    mockConfigData.repoRoot = "/repo";
    mockConfigData.trust = null;
  });

  it("resets the draft when async trust data arrives", () => {
    const { rerender } = renderPage();

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "true");

    mockConfigData.trust = {
      projectId: "project-1",
      repoRoot: "/repo",
      trustedAt: "2026-02-09T12:00:00.000Z",
      trustMode: "persistent",
      capabilities: { readFiles: false, runCommands: false },
    };

    rerender(
      <KeyboardProvider>
        <TrustPermissionsPage />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("checkbox", { name: /repository access/i })).toHaveAttribute("aria-checked", "false");
  });
});
