import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  mockGetReviewContext,
  mockNavigate,
  mockRequest,
  renderPage,
  setupDiagnosticsMocks,
  waitForDiagnosticsActions,
} from "./page.test-harness";

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
