import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
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

  it("heads the page with the shared settings copy", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: SETTINGS_SCREEN_COPY["agent-execution"].title }),
    ).toBeInTheDocument();
    expect(screen.getByText(SETTINGS_SCREEN_COPY["agent-execution"].subtitle)).toBeInTheDocument();
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

  it("keeps radio focus and ArrowDown navigation after pointer re-entry from footer actions", async () => {
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    const sequential = within(modeGroup).getByRole("radio", { name: /sequential/i });
    const parallel = within(modeGroup).getByRole("radio", { name: /parallel/i });
    await waitFor(() => expect(sequential).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(sequential);
    expect(sequential).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(parallel).toHaveFocus();
  });

  it.each([
    "{Enter}",
    " ",
  ])("commits the highlighted execution mode with %s inside the radio group", async (key) => {
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    await waitFor(() =>
      expect(within(modeGroup).getByRole("radio", { name: /sequential/i })).toHaveFocus(),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.keyboard(`{ArrowDown}${key}`);

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("does not change the execution mode on Enter when focus is outside the radio group", async () => {
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    const parallel = within(modeGroup).getByRole("radio", { name: /parallel/i });
    await waitFor(() =>
      expect(within(modeGroup).getByRole("radio", { name: /sequential/i })).toHaveFocus(),
    );

    await user.keyboard("{ArrowDown}");
    expect(parallel).toHaveFocus();

    parallel.blur();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the selected execution mode and navigates once the mutation resolves", async () => {
    mockSaveSettings.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderPage();

    const modeGroup = screen.getByRole("radiogroup", { name: /agent execution mode/i });
    const parallel = within(modeGroup).getByRole("radio", { name: /parallel/i });

    await user.click(parallel);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSaveSettings).toHaveBeenCalledWith({ agentExecution: "parallel" });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" }));
  });
});
