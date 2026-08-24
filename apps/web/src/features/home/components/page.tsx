import { useActiveReviewSession, useCreateReview, useReviews } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus, selectResumableSession } from "@diffgazer/core/navigation";
import type { HomeContextInfo, MenuAction } from "@diffgazer/core/schemas/presentation";
import {
  buildHomeContextInfo,
  MENU_ITEMS,
  resolveLastRunRequest,
} from "@diffgazer/core/schemas/presentation";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { useConfigData } from "@/hooks/use-config";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { clearScopedRouteState, useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { shutdown } from "@/lib/shutdown";
import { HomePagePresentation } from "./presentation";

export function HomePage() {
  const { loadState, provider, model, trust, repoRoot, projectId } = useConfigData();
  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data?.reviews ?? [];
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const createReview = useCreateReview();
  const providerConsent = useProviderConsent();

  const { isTrusted, needsTrust } = deriveTrustStatus({ trust, projectId, repoRoot });
  const unstagedActive = useActiveReviewSession("unstaged");
  const stagedActive = useActiveReviewSession("staged");
  const resumableSession = selectResumableSession(
    unstagedActive.data?.session,
    stagedActive.data?.session,
  );

  const context: HomeContextInfo = buildHomeContextInfo(
    { provider, model, trustedRepoRoot: trust?.repoRoot },
    reviews[0],
    isTrusted,
    resolveLastRunRequest(reviewsQuery),
  );

  const [highlighted, setHighlighted] = useScopedRouteState<MenuAction | null>(
    "highlighted",
    MENU_ITEMS[0]?.id ?? null,
  );

  if (loadState.status !== "ready") {
    return <ConfigurationStatus status={loadState.status} />;
  }

  return (
    <HomePagePresentation
      context={context}
      isTrusted={isTrusted}
      needsTrust={needsTrust}
      repoRoot={repoRoot}
      resumableSession={resumableSession}
      isResumeUnavailable={unstagedActive.isError || stagedActive.isError}
      refetchActiveSession={async () => {
        // Both modes are re-read: the review the server refused for may be the
        // other mode's, and a session found anywhere answers the question even
        // if the sibling read failed.
        const reads = await Promise.all([unstagedActive.refetch(), stagedActive.refetch()]);
        const session = reads.map((read) => read.data?.session).find(Boolean) ?? null;
        if (session === null && reads.some((read) => read.isError)) {
          return { status: "unreadable" };
        }
        return { status: "read", session };
      }}
      highlighted={highlighted}
      searchError={typeof search.error === "string" ? search.error : undefined}
      onHighlightChange={setHighlighted}
      navigate={navigate}
      createReview={(input) => createReview.mutateAsync(input)}
      requireProviderConsent={providerConsent.require}
      clearScopedRouteState={clearScopedRouteState}
      shutdown={shutdown}
    />
  );
}
