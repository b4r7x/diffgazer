/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { render as renderDom, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import type { Route } from "../../../lib/routes";
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
  useCreateReview: vi.fn(),
  useConfigurationInit: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useCreateReview: apiMocks.useCreateReview,
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

function createFreshStartWrapper(initialRoute: Route) {
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
      makeCreateReviewResponse({ reviewId: "review-fresh", session: { mode } }),
    );
    apiMocks.useCreateReview.mockReturnValue({ mutateAsync: apiMocks.createReview });
    apiMocks.useConfigurationInit.mockReturnValue({
      data: makeReadyInitResponse(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  test("auto-starts a review when navigated with mode but no reviewId", async () => {
    const wrapper = createFreshStartWrapper({ screen: "review", mode: "unstaged" });

    renderDom(<FreshStartHarness mode="unstaged" />, { wrapper });

    await waitFor(() => expect(apiMocks.createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
  });
});
