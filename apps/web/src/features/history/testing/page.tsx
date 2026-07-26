import type { BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import type { ReviewIssue, ReviewMetadata, ReviewResponse } from "@diffgazer/core/schemas/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import type { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, type Mock, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { ConfigProvider } from "@/hooks/use-config";

const SETTINGS_FIXTURE: InitResponse["settings"] = {
  theme: "terminal",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

const PROVIDERS_FIXTURE: InitResponse["providers"] = [
  { provider: "gemini", hasApiKey: true, isActive: true },
];

export function makeInitResponse(
  project: InitResponse["project"] = untrustedProject(),
): InitResponse {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: PROVIDERS_FIXTURE,
    settings: SETTINGS_FIXTURE,
    configured: true,
    project,
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: project.trust !== null,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

export function trustedProject(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/repo",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

export function untrustedProject(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: null,
  };
}

export function projectWithoutReadAccess(): InitResponse["project"] {
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

export function projectWithTrustForPreviousRoot(): InitResponse["project"] {
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

export let mockLoadInit: Mock<BoundApi["loadInit"]>;
export let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
export let mockGetReviews: Mock<BoundApi["getReviews"]>;
export let mockGetReview: Mock<BoundApi["getReview"]>;

export function setupApiMocks(project: InitResponse["project"] = trustedProject()) {
  mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse(project));
  mockGetProviderStatus = vi
    .fn<BoundApi["getProviderStatus"]>()
    .mockResolvedValue(PROVIDERS_FIXTURE);
  mockGetReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue(defaultReviewsResponse());
  mockGetReview = vi
    .fn<BoundApi["getReview"]>()
    .mockImplementation(async (id) => makeReviewResponse(id));
}

export function renderHistoryPage(
  ui: ReactNode,
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const { Wrapper: ApiWrapper, queryClient } = createTestQueryWrapper({
    ApiProvider,
    api: {
      loadInit: mockLoadInit,
      getProviderStatus: mockGetProviderStatus,
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

export function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

export async function focusRunsList() {
  const runsList = await screen.findByRole("listbox", { name: /review runs/i });
  runsList.focus();
  await waitFor(() => expect(runsList).toHaveFocus());
  return runsList;
}
