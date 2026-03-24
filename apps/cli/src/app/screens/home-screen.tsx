import type { ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useInit, useReviews, useActiveReviewSession, useShutdown } from "@diffgazer/api/hooks";
import { ContextSidebar } from "../../features/home/components/context-sidebar.js";
import { HomeMenu } from "../../features/home/components/home-menu.js";
import { TrustPanel } from "../../features/home/components/trust-panel.js";
import { MAIN_MENU_SHORTCUTS } from "../../config/navigation.js";
import type { MenuAction } from "../../config/navigation.js";

export function HomeScreen(): ReactElement {
  useScope("home");
  usePageFooter({ shortcuts: MAIN_MENU_SHORTCUTS });
  useBackHandler();

  const { navigate } = useNavigation();
  const { data: initData, refetch: refreshInit } = useInit();
  const { data: reviewsData } = useReviews();
  const { data: sessionData } = useActiveReviewSession();
  const shutdown = useShutdown();

  const mostRecent = reviewsData?.reviews[0];
  const lastReviewDate = mostRecent?.createdAt;
  const lastReviewIssues = mostRecent?.issueCount;
  const hasActiveSession = sessionData?.session !== null;

  const trust = initData?.project.trust ?? null;
  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const needsTrust = Boolean(
    initData?.project.projectId && initData?.project.path && trust === null
  );

  const providerName = initData?.config?.provider ?? undefined;
  const modelName = initData?.config?.model ?? undefined;

  const trustStatus: "trusted" | "untrusted" | "unknown" = needsTrust
    ? "untrusted"
    : isTrusted
      ? "trusted"
      : "unknown";

  function handleTrustAccept(_caps: { readFiles: boolean; runCommands: boolean }) {
    // Trust already persisted by TrustPanel via useSaveTrust.
    // Refresh init data so the home screen reflects the new trust state.
    refreshInit();
  }

  const onAction = (action: string) => {
    const menuAction = action as MenuAction;

    switch (menuAction) {
      case "review-unstaged":
        navigate({ screen: "review", mode: "unstaged" });
        break;
      case "review-staged":
        navigate({ screen: "review", mode: "staged" });
        break;
      case "resume-review":
        if (hasActiveSession) {
          navigate({ screen: "review" });
        }
        break;
      case "history":
        navigate({ screen: "history" });
        break;
      case "settings":
        navigate({ screen: "settings" });
        break;
      case "help":
        navigate({ screen: "help" });
        break;
      case "quit":
        shutdown.mutate(undefined, {
          onSettled: () => process.exit(0),
        });
        break;
    }
  };

  const disableReview = !isTrusted;

  return (
    <Box>
      <Box width={30}>
        <ContextSidebar
          providerName={providerName}
          modelName={modelName}
          lastReviewDate={lastReviewDate}
          lastReviewIssues={lastReviewIssues}
          trustStatus={trustStatus}
        />
      </Box>
      <Box flexGrow={1}>
        {needsTrust ? (
          <TrustPanel onAccept={handleTrustAccept} />
        ) : (
          <HomeMenu isActive onAction={onAction} disableReview={disableReview} />
        )}
      </Box>
    </Box>
  );
}
