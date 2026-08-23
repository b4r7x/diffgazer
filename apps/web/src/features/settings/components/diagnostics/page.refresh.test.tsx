import type { BoundApi } from "@diffgazer/core/api";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getOverallStatus,
  makeContextResponse,
  mockGetReviewContext,
  mockLoadInit,
  mockRefreshReviewContext,
  mockRequest,
  renderPage,
  setupDiagnosticsMocks,
  waitForDiagnosticsActions,
  waitForReady,
} from "../../testing/diagnostics-page";

describe("SettingsDiagnosticsPage diagnostics refresh", () => {
  beforeEach(() => {
    setupDiagnosticsMocks();
  });

  it("shows refresh progress and blocks overlapping refresh-all actions", async () => {
    const user = userEvent.setup();
    let resolveHealth: ((value: Awaited<ReturnType<BoundApi["request"]>>) => void) | undefined;
    let resolveContext:
      | ((value: Awaited<ReturnType<BoundApi["getReviewContext"]>>) => void)
      | undefined;

    renderPage();
    await waitForReady();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;
    const initialInitCalls = mockLoadInit.mock.calls.length;

    mockRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    mockGetReviewContext.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve;
        }),
    );

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Refreshing..." })).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Refreshing..." }));
    await user.keyboard("r");

    // No additional refetches issued while refresh-all is in-flight.
    expect(mockRequest.mock.calls.length).toBe(initialHealthCalls + 1);
    expect(mockGetReviewContext.mock.calls.length).toBe(initialContextCalls + 1);
    expect(mockLoadInit.mock.calls.length).toBe(initialInitCalls + 1);

    resolveHealth?.(new Response(null));
    resolveContext?.(makeContextResponse());

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "false");
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
    });
  });

  it.each([
    "{Enter}",
    "r",
    "R",
  ])("keeps focus inside the panel while %s runs refresh-all and returns it to the action row", async (key) => {
    const user = userEvent.setup();
    let resolveHealth: ((value: Awaited<ReturnType<BoundApi["request"]>>) => void) | undefined;
    let resolveContext:
      | ((value: Awaited<ReturnType<BoundApi["getReviewContext"]>>) => void)
      | undefined;

    renderPage();
    await waitForDiagnosticsActions();

    mockRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    mockGetReviewContext.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve;
        }),
    );

    await user.keyboard(key);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    });
    // The self-disabling action must park focus on the panel content, never body.
    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    expect(document.body).not.toHaveFocus();
    expect(diagnosticsPanel.contains(document.activeElement)).toBe(true);

    resolveHealth?.(new Response(null));
    resolveContext?.(makeContextResponse());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toHaveFocus();
    });
  });

  it("reclaims focus from document.body once refresh-all re-enables the actions", async () => {
    const user = userEvent.setup();
    let resolveHealth: ((value: Awaited<ReturnType<BoundApi["request"]>>) => void) | undefined;
    let resolveContext:
      | ((value: Awaited<ReturnType<BoundApi["getReviewContext"]>>) => void)
      | undefined;

    renderPage();
    await waitForDiagnosticsActions();

    mockRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    mockGetReviewContext.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve;
        }),
    );

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    });

    // A real browser drops focus on document.body when the focused button turns
    // disabled; jsdom parks it on the panel content instead, so recreate the
    // browser's worst case before the refresh settles.
    act(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    });
    expect(document.body).toHaveFocus();

    resolveHealth?.(new Response(null));
    resolveContext?.(makeContextResponse());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toHaveFocus();
    });
  });

  it("shows the failed source error after refresh-all", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    mockRequest.mockRejectedValueOnce(new Error("server down"));

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("Error: server down")).toBeVisible();
    expect(screen.getByText("server down")).toBeVisible();
    expect(await screen.findByText("Needs attention")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });

  it("does not resurrect a recovered refresh error when another source later fails", async () => {
    const user = userEvent.setup();
    // A real context failure, not the 404 that only means "no snapshot yet": that
    // state is reported as Missing in a warning tone and raises no error callout.
    const contextUnavailable = new Error("context unavailable");
    mockGetReviewContext
      .mockReset()
      .mockRejectedValueOnce(contextUnavailable)
      .mockRejectedValueOnce(contextUnavailable)
      .mockResolvedValue(makeContextResponse());
    renderPage();
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));
    expect(await screen.findByText("context unavailable")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(screen.queryByText("context unavailable")).not.toBeInTheDocument();
    });
    expect(getOverallStatus()).toHaveTextContent("Ready");

    mockRequest.mockRejectedValueOnce(new Error("later server failure"));
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("later server failure")).toBeVisible();
    expect(screen.queryByText("context unavailable")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Refresh failed for some diagnostics sources."),
    ).not.toBeInTheDocument();
  });

  it("clears a context-generation error after refresh-all refetches context successfully", async () => {
    const user = userEvent.setup();
    mockRefreshReviewContext.mockRejectedValueOnce(new Error("context generation failed"));
    renderPage();
    await waitForReady();

    await user.click(await screen.findByRole("button", { name: "Regenerate Context" }));
    expect(await screen.findByText("context generation failed")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(screen.queryByText("context generation failed")).not.toBeInTheDocument();
    });
    expect(getOverallStatus()).toHaveTextContent("Ready");
  });

  it("updates Health when a later health poll recovers after a failed refresh", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    await waitForReady();

    mockRequest.mockRejectedValueOnce(new Error("server down"));
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    await waitFor(() => {
      expect(within(diagnosticsPanel).getByText("Error: server down")).toBeVisible();
      expect(within(diagnosticsPanel).getByText("Needs attention")).toBeVisible();
    });

    mockRequest.mockResolvedValueOnce(new Response(null));
    await queryClient.refetchQueries({ queryKey: ["server", "health"] });

    await waitFor(() => {
      expect(within(diagnosticsPanel).getByText("Connected")).toBeVisible();
      expect(within(diagnosticsPanel).queryByText("Needs attention")).not.toBeInTheDocument();
      expect(within(diagnosticsPanel).queryByText("server down")).not.toBeInTheDocument();
    });
  });
});
