import { useActiveReviewSession, useCreateReview, useReviews } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus, selectResumableSession } from "@diffgazer/core/navigation";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { buildHomeContextInfo, MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { shutdown } from "@/features/home/lib/shutdown";
import { useConfigData } from "@/hooks/use-config";
import { clearScopedRouteState, useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { HomePagePresentation } from "./presentation";

export function HomePage() {
  const { provider, model, trust, repoRoot, projectId } = useConfigData();
  const reviews = useReviews().data?.reviews ?? [];
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const createReview = useCreateReview();

  const { isTrusted, needsTrust } = deriveTrustStatus({ trust, projectId, repoRoot });
  const unstagedActive = useActiveReviewSession("unstaged");
  const stagedActive = useActiveReviewSession("staged");
  const resumableSession = selectResumableSession(
    unstagedActive.data?.session,
    stagedActive.data?.session,
  );

  const context: ContextInfo = buildHomeContextInfo(
    { provider, model, trustedRepoRoot: trust?.repoRoot },
    reviews[0],
    isTrusted,
  );

  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    "highlighted",
    MENU_ITEMS[0]?.id ?? null,
  );

  return (
    <HomePagePresentation
      context={context}
      isTrusted={isTrusted}
      needsTrust={needsTrust}
      projectId={projectId}
      repoRoot={repoRoot}
      resumableSession={resumableSession}
      highlighted={highlighted}
      searchError={typeof search.error === "string" ? search.error : undefined}
      onHighlightChange={setHighlighted}
      navigate={navigate}
      createReview={(input) => createReview.mutateAsync(input)}
      clearScopedRouteState={clearScopedRouteState}
      shutdown={shutdown}
    />
  );
}
