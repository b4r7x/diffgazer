import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  mockGetReviewContext,
  mockNavigate,
  mockRequest,
  renderPage,
  setupDiagnosticsMocks,
  waitForDiagnosticsActions,
} from "../../testing/diagnostics-page";

describe("SettingsDiagnosticsPage diagnostics keyboard", () => {
  beforeEach(() => {
    setupDiagnosticsMocks();
  });

  it("navigates to /settings and fires no diagnostics action when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
    expect(mockRequest.mock.calls.length).toBe(initialHealthCalls);
    expect(mockGetReviewContext.mock.calls.length).toBe(initialContextCalls);
  });

  // The screen hands focus to its action row on entry, so the resting chrome is
  // what shows once focus leaves again: the state follows focus rather than being
  // pinned on by the markup.
  it("brackets the panel only while focus sits inside it", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const panel = screen.getByRole("region", { name: /system diagnostics/i });
    expect(panel).toHaveAttribute("data-state", "focused");

    await user.click(document.body);

    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).not.toHaveFocus();
    expect(panel).not.toHaveAttribute("data-state");
  });

  it("scrolls the snapshot pane with page and edge keys while focus stays on the actions", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const pane = screen.getByRole("region", { name: "Diagnostic snapshot" });
    // jsdom has no layout; pin the metrics that make the pane overflow.
    Object.defineProperty(pane, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(pane, "scrollHeight", { value: 1000, configurable: true });

    await user.keyboard("{PageDown}");
    expect(pane.scrollTop).toBe(80);

    await user.keyboard("{End}");
    expect(pane.scrollTop).toBe(1000);

    await user.keyboard("{PageUp}");
    expect(pane.scrollTop).toBe(920);

    await user.keyboard("{Home}");
    expect(pane.scrollTop).toBe(0);

    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toHaveFocus();
  });

  it.each(["r", "R"])("refreshes all diagnostics sources when %s is pressed", async (key) => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    await user.keyboard(key);

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });
});
