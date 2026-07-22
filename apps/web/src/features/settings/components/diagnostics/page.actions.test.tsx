import { type BoundApi } from "@diffgazer/core/api";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  mockGetReviewContext,
  mockRefreshReviewContext,
  mockRequest,
  renderPage,
  setupDiagnosticsMocks,
  waitForDiagnosticsActions,
} from "./page.test-harness";

describe("SettingsDiagnosticsPage diagnostics actions", () => {
  beforeEach(() => {
    setupDiagnosticsMocks();
  });

  it("activates diagnostics actions from the visible action row", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;
    const refreshButton = screen.getByRole("button", { name: "Refresh Diagnostics" });
    const regenerateButton = screen.getByRole("button", { name: "Regenerate Context" });
    const actionGroup = screen.getByRole("group", { name: "Diagnostics actions" });

    expect(within(actionGroup).getByRole("button", { name: "Refresh Diagnostics" })).toBeVisible();
    expect(within(actionGroup).getByRole("button", { name: "Regenerate Context" })).toBeVisible();

    await user.click(regenerateButton);

    await waitFor(() => {
      expect(mockRefreshReviewContext).toHaveBeenCalledWith({ force: true });
    });

    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });

  it("keeps diagnostics actions active after ArrowUp because there is no content zone", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });
});
