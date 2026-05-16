import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/testing";

type QueryStateHandlers = {
  loading: () => unknown;
  error: (error: Error) => unknown;
  success: () => unknown;
};

const { mockNavigate, mockSaveSettings } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useSettings: () => ({
    data: { agentExecution: "sequential" },
    error: null,
    isLoading: false,
  }),
  useSaveSettings: () => ({
    isPending: false,
    mutateAsync: mockSaveSettings,
  }),
  matchQueryState: (
    query: { isLoading?: boolean; error?: Error | null },
    handlers: QueryStateHandlers,
  ) => {
    if (query.isLoading) return handlers.loading();
    if (query.error) return handlers.error(query.error);
    return handlers.success();
  },
}));

import { SettingsAgentExecutionPage } from "./page";

function renderPage() {
  return renderWithProviders(<SettingsAgentExecutionPage />);
}

describe("SettingsAgentExecutionPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
  });

  it("moves from execution mode choices to footer actions at the lower boundary", async () => {
    const user = userEvent.setup();
    renderPage();

    const sequential = screen.getByRole("radio", { name: /sequential/i });
    const parallel = screen.getByRole("radio", { name: /parallel/i });

    await waitFor(() => expect(sequential).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(parallel).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("does not move footer focus onto a disabled save action", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByRole("radio", { name: /sequential/i })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    expect(save).toBeDisabled();

    await user.keyboard("{ArrowRight}");

    expect(cancel).toHaveFocus();
    expect(save).not.toHaveFocus();
  });
});
