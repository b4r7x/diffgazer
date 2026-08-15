import type { BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ReviewIssue, ReviewMetadata, ReviewResponse } from "@diffgazer/core/schemas/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import type { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import {
  makeShellApiOverrides,
  makeShellInitResponse,
  SHELL_TRUSTED_PROJECT,
} from "@/testing/shell-fixtures";

export function makeInitResponse(project = SHELL_TRUSTED_PROJECT) {
  return makeShellInitResponse({ project });
}

export function trustedProject() {
  return SHELL_TRUSTED_PROJECT;
}

export function untrustedProject() {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: null,
  };
}

export function projectWithoutReadAccess() {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/repo",
      capabilities: { readFiles: false, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

export function projectWithTrustForPreviousRoot() {
  return {
    projectId: "proj-1",
    path: "/moved/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/old/repo",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

export function makeReviewResponse(
  id: string,
  issues: ReviewIssue[] = [],
  metadata: ReviewMetadata = makeReviewMetadata({ id }),
): ReviewResponse {
  return {
    review: {
      metadata,
      result: { issues },
      gitContext: { branch: "main", commit: "abc123", fileCount: 1, additions: 0, deletions: 0 },
    },
  };
}

export function defaultReviewsResponse() {
  return {
    reviews: [
      makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
      makeReviewMetadata({ id: "22222222-2222-4222-8222-222222222222" }),
    ],
  };
}

export let mockGetReviews: Mock<BoundApi["getReviews"]>;
export let mockGetReview: Mock<BoundApi["getReview"]>;
export let mockLoadInit: Mock<BoundApi["loadConfigurationInit"]>;
let shellApiOverrides: Partial<BoundApi>;

export function setupApiMocks(project = trustedProject()) {
  shellApiOverrides = makeShellApiOverrides(makeInitResponse(project));
  mockLoadInit = shellApiOverrides.loadConfigurationInit as Mock<BoundApi["loadConfigurationInit"]>;
  mockGetReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue(defaultReviewsResponse());
  mockGetReview = vi
    .fn<BoundApi["getReview"]>()
    .mockImplementation(async (id) => makeReviewResponse(id));
  return shellApiOverrides;
}

export function renderHistoryPage(
  ui: ReactNode,
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const { Wrapper: ApiWrapper, queryClient } = createTestQueryWrapper({
    ApiProvider,
    api: {
      ...shellApiOverrides,
      getReviews: mockGetReviews,
      getReview: mockGetReview,
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <ConfigProvider>
          <FooterProvider>
            <KeyboardProvider>{children}</KeyboardProvider>
          </FooterProvider>
        </ConfigProvider>
      </ApiWrapper>
    );
  }

  const renderResult = render(ui, { wrapper: Wrapper });
  return { ...renderResult, queryClient };
}

export async function focusRunsList() {
  const runsList = await screen.findByRole("listbox", { name: /review runs/i });
  runsList.focus();
  await waitFor(() => expect(runsList).toHaveFocus());
  return runsList;
}
