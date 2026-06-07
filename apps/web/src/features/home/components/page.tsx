import { useActiveReviewSession, useApi, useCreateReview } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useConfigData } from "@/app/providers/config";
import { shutdown } from "@/features/home/shutdown";
import { useReviewHistory } from "@/hooks/use-review-history";
import { clearScopedRouteState, useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { HomePagePresentation } from "./presentation";

const MAIN_MENU_ITEMS = MENU_ITEMS.filter((item) => item.id !== "help");

export function HomePage() {
  const { provider, model, trust, repoRoot, projectId } = useConfigData();
  const { reviews } = useReviewHistory();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const api = useApi();
  const createReview = useCreateReview();

  const { isTrusted, needsTrust } = deriveTrustStatus({ trust, projectId, repoRoot });
  const unstagedActive = useActiveReviewSession("unstaged");
  const stagedActive = useActiveReviewSession("staged");
  const hasResumableSession =
    unstagedActive.data?.session != null || stagedActive.data?.session != null;

  const mostRecentReview = reviews[0];
  const context: ContextInfo = {
    providerName: provider,
    providerMode: model,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    trustedDir: isTrusted ? trust?.repoRoot : undefined,
  };

  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    "highlighted",
    MAIN_MENU_ITEMS[0]?.id ?? null,
  );

  return (
    <HomePagePresentation
      context={context}
      isTrusted={isTrusted}
      needsTrust={needsTrust}
      projectId={projectId}
      repoRoot={repoRoot}
      hasResumableSession={hasResumableSession}
      highlighted={highlighted}
      searchError={typeof search.error === "string" ? search.error : undefined}
      onHighlightChange={setHighlighted}
      navigate={navigate}
      createReview={(input) => createReview.mutateAsync(input)}
      getActiveReviewSession={(mode) => api.getActiveReviewSession(mode)}
      clearScopedRouteState={clearScopedRouteState}
      shutdown={shutdown}
    />
  );
}
