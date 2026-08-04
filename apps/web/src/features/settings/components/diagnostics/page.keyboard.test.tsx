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
