import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";

type QueryStateHandlers = {
  loading: () => unknown;
  error: (error: Error) => unknown;
  success: () => unknown;
};

const { mockNavigate, mockSaveSettings } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

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
  return render(
    <KeyboardProvider>
      <SettingsAgentExecutionPage />
    </KeyboardProvider>,
  );
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
    expect(parallel).toHaveAttribute("data-highlighted", "true");

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(parallel).not.toHaveAttribute("data-highlighted");
  });
});
