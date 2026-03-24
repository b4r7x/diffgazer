import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useInit } from "../../hooks/use-init.js";
import { api } from "../../lib/api.js";
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
  const { data: initData, refresh: refreshInit } = useInit();

  const [lastReviewDate, setLastReviewDate] = useState<string | undefined>();
  const [lastReviewIssues, setLastReviewIssues] = useState<number | undefined>();
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomeData() {
      try {
        const [reviewsRes, sessionRes] = await Promise.all([
          api.getReviews(),
          api.getActiveReviewSession(),
        ]);

        if (cancelled) return;

        const mostRecent = reviewsRes.reviews[0];
        if (mostRecent) {
          setLastReviewDate(mostRecent.createdAt);
          setLastReviewIssues(mostRecent.issueCount);
        }

        setHasActiveSession(sessionRes.session !== null);
      } catch {
        // Non-critical — sidebar will show defaults
      }
    }

    void fetchHomeData();
    return () => { cancelled = true; };
  }, []);

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
    // Trust already persisted by TrustPanel via api.saveTrust().
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
        void api.shutdown().finally(() => {
          process.exit(0);
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
