import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import { act, screen } from "@testing-library/react";
import { HistoryPage } from "./page";
import {
  makeInitResponse,
  mockGetProviderStatus,
  mockGetReviews,
  mockLoadInit,
  projectWithoutReadAccess,
  projectWithTrustForPreviousRoot,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
  untrustedProject,
} from "./page.test-utils";

describe("HistoryPage trust workflow", () => {
  beforeEach(() => {
    setupApiMocks(untrustedProject());
  });

  it("shows the trust workflow on direct /history access before trust is granted", async () => {
    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("shows history after trust is granted and returns to trust workflow when trust is revoked", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(trustedProject()));
    const { queryClient } = renderHistoryPage(<HistoryPage />);
    expect(await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).toBeInTheDocument();

    await act(async () => {
      queryClient.setQueryData(["config", "init"], makeInitResponse(untrustedProject()));
    });

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("shows the trust workflow when stored trust denies repository reads", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(projectWithoutReadAccess()));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
    expect(mockGetReviews).not.toHaveBeenCalled();
  });

  it("shows the trust workflow when stored trust belongs to the previous repository root", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(projectWithTrustForPreviousRoot()));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.getByText("/moved/repo")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
    expect(mockGetReviews).not.toHaveBeenCalled();
  });

  it("keeps trusted history available when only provider status fails", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus.mockRejectedValue(new Error("provider status unavailable"));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });
});
