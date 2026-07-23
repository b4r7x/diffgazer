import type { BoundApi } from "@diffgazer/core/api";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getOverallStatus,
  makeContextResponse,
  makeInitResponse,
  mockGetReviewContext,
  mockLoadInit,
  mockRequest,
  renderPage,
  setupDiagnosticsMocks,
  waitForReady,
} from "./page.test-harness";

describe("SettingsDiagnosticsPage diagnostics status", () => {
  beforeEach(() => {
    setupDiagnosticsMocks();
  });

  it("shows diagnostics presentation labels instead of raw state values", async () => {
    renderPage();
    await waitForReady();

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });

    await waitFor(() => {
      expect(within(diagnosticsPanel).getAllByText("Ready").length).toBeGreaterThan(0);
    });
    expect(within(diagnosticsPanel).queryByText("[ready]")).not.toBeInTheDocument();
    expect(within(diagnosticsPanel).queryByText("success")).not.toBeInTheDocument();
  });

  it("keeps error, loading, setup-needed, and ready precedence across source transitions", async () => {
    const healthRecovery = createDeferred<Awaited<ReturnType<BoundApi["request"]>>>();
    const init = createDeferred<Awaited<ReturnType<BoundApi["loadInit"]>>>();
    const context = createDeferred<Awaited<ReturnType<BoundApi["getReviewContext"]>>>();
    mockRequest
      .mockRejectedValueOnce(new Error("server down"))
      .mockReturnValueOnce(healthRecovery.promise);
    mockLoadInit.mockReturnValueOnce(init.promise);
    mockGetReviewContext.mockReturnValueOnce(context.promise);
    const { queryClient } = renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));

    const healthRefetch = queryClient.refetchQueries({ queryKey: ["server", "health"] });
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Checking"));
    healthRecovery.resolve(new Response(null));
    await healthRefetch;

    init.resolve(
      makeInitResponse({
        config: null,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
      }),
    );
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Checking"));

    context.reject(Object.assign(new Error("context missing"), { status: 404 }));
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));

    mockLoadInit.mockResolvedValue(makeInitResponse());
    mockGetReviewContext.mockResolvedValue(makeContextResponse());
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["config", "init"] }),
      queryClient.refetchQueries({ queryKey: ["review", "context"] }),
    ]);

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Ready"));
  });

  it("reports an init failure as the overall error when other sources are ready", async () => {
    mockLoadInit.mockReset().mockRejectedValue(new Error("init failed"));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));
    expect(screen.getByText("Error: init failed")).toBeVisible();
  });

  it("reports a context failure as the overall error when other sources are ready", async () => {
    mockGetReviewContext.mockReset().mockRejectedValue(new Error("context failed"));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));
    expect(screen.getByText("Error: context failed")).toBeVisible();
  });

  it("reports incomplete setup even when context is ready", async () => {
    mockLoadInit.mockReset().mockResolvedValue(
      makeInitResponse({
        config: null,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
      }),
    );
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));
  });

  it("reports missing context even when configured setup is ready", async () => {
    mockGetReviewContext
      .mockReset()
      .mockRejectedValue(Object.assign(new Error("context missing"), { status: 404 }));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));
  });
});
