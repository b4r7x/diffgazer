/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { CreateReviewResponse, ReviewMode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, render as renderDom, waitFor } from "@testing-library/react";
import { render as renderInk } from "ink-testing-library";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import type { Route } from "../../../lib/routes";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewContainer } from "./container";

const shellList = makeAllConfigurationsListResponse();

function makeReadyInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: shellList.configurations,
    selectedConfigurationId: shellList.selectedConfigurationId,
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      providerConsent: null,
    },
    project: {
      projectId: "project-1",
      path: "/Users/dev/Projects/diffgazer-workspace",
      trust: {
        repoRoot: "/Users/dev/Projects/diffgazer-workspace",
        capabilities: { readFiles: true, runCommands: false },
        projectId: "project-1",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent" as const,
      },
    },
  };
}

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  useConfigurationInit: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: apiMocks.useConfigurationInit,
    useReviewSessionCache: () => ({
      clearActiveSession: apiMocks.clearActiveSession,
    }),
  };
});

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, contentColumns: 100, contentRows: 26 }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function createFreshStartWrapper(initialRoute: Route, apiOverrides: Partial<BoundApi> = {}) {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: vi.fn(async () => ({
      theme: "terminal" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      providerConsent: null,
    })),
    ...apiOverrides,
  } satisfies BoundApi;
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({ api });

  return ({ children }: { children: ReactNode }) => (
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <ApiWrapper>
          <NavigationProvider initialRoute={initialRoute}>
            <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
          </NavigationProvider>
        </ApiWrapper>
      </TerminalKeyboardProvider>
    </CliThemeProvider>
  );
}

function FreshStartHarness({ mode }: { mode: Exclude<ReviewMode, "files"> }): ReactElement {
  return <ReviewContainer mode={mode} />;
}

describe("ReviewContainer fresh start", () => {
  beforeEach(() => {
    apiMocks.createReview.mockImplementation(async ({ mode = "staged" }: { mode?: ReviewMode }) =>
      makeCreateReviewResponse({ session: { mode } }),
    );
    apiMocks.useConfigurationInit.mockReturnValue({
      data: makeReadyInitResponse(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  test("auto-starts a review when navigated with mode but no reviewId", async () => {
    const wrapper = createFreshStartWrapper(
      { screen: "review", mode: "unstaged" },
      { createReview: apiMocks.createReview },
    );

    renderDom(<FreshStartHarness mode="unstaged" />, { wrapper });

    await waitFor(() => expect(apiMocks.createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
  });

  test("paints the pending steps for the create round-trip, then the outcome the response settled", async () => {
    const created = createDeferred<CreateReviewResponse>();
    const Wrapper = createFreshStartWrapper(
      { screen: "review", mode: "staged" },
      {
        createReview: vi.fn(() => created.promise),
        // Attached but silent: the frames under test can only come from the
        // create response, never from a replayed event.
        resumeReviewStream: vi.fn(() => new Promise<never>(() => {})),
      },
    );

    const { frames, lastFrame } = renderInk(
      <Wrapper>
        <FreshStartHarness mode="staged" />
      </Wrapper>,
    );

    // Accepted behavior: the run is already requested, so the steps it is about
    // to walk are drawn pending for the round-trip instead of a centered wait.
    await waitUntil(() => (lastFrame() ?? "").includes("Collect diff"));

    await act(async () => {
      created.resolve(
        makeCreateReviewResponse({ session: { mode: "staged" }, outcome: "no-diff" }),
      );
      await created.promise;
    });

    await waitUntil(() => (lastFrame() ?? "").includes("No staged changes"));

    const settledFrame = frames.findIndex((frame) => frame.includes("No staged changes"));
    expect(frames.slice(settledFrame).some((frame) => frame.includes("Collect diff"))).toBe(false);
  });
});
