import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/testing/render";

const { mockNavigate, mockSaveSettings } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@diffgazer/core/api/hooks")>(
    "@diffgazer/core/api/hooks",
  );

  return {
    ...actual,
    useSettings: () => ({
      data: { agentExecution: "sequential" },
      error: null,
      isLoading: false,
    }),
    useSaveSettings: () => ({
      isPending: false,
      mutateAsync: mockSaveSettings,
    }),
  };
});

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

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    const sequential = within(modeGroup).getByRole("radio", { name: /sequential/i });
    const parallel = within(modeGroup).getByRole("radio", { name: /parallel/i });

    await waitFor(() => expect(sequential).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(parallel).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("does not move footer focus onto a disabled save action", async () => {
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    await waitFor(() =>
      expect(within(modeGroup).getByRole("radio", { name: /sequential/i })).toHaveFocus(),
    );

    await user.keyboard("{ArrowDown}{ArrowDown}");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    expect(save).toBeDisabled();

    await user.keyboard("{ArrowRight}");

    expect(cancel).toHaveFocus();
    expect(save).not.toHaveFocus();
  });

  it("enables Save once a different execution mode is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    await waitFor(() =>
      expect(within(modeGroup).getByRole("radio", { name: /sequential/i })).toHaveFocus(),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.keyboard("{ArrowDown} ");

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
