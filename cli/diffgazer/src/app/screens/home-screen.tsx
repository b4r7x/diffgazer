import type { ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useResponsive } from "../../hooks/use-terminal-dimensions.js";
import { useInit, useReviews, useActiveReviewSession, useShutdown } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import type { ContextInfo, Shortcut } from "@diffgazer/core/schemas/ui";
import { useExit } from "../../hooks/use-exit.js";
import { createHomeMenuAction } from "../../features/home/lib/create-home-menu-action.js";
import { ContextSidebar } from "../../features/home/components/context-sidebar.js";
import { HomeMenu } from "../../features/home/components/home-menu.js";
import { TrustPanel } from "../../features/home/components/trust-panel.js";
import { MAIN_MENU_SHORTCUTS } from "@diffgazer/core/schemas/ui";

const TRUST_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate Permissions" },
  { key: "Enter/Space", label: "Toggle Permission" },
  { key: "q", label: "Quit" },
];

const TRUST_FOOTER_RIGHT_SHORTCUTS: Shortcut[] = [
  { key: "s", label: "Settings" },
  { key: "h", label: "Help" },
];

const EMPTY_SHORTCUTS: Shortcut[] = [];

export function HomeScreen(): ReactElement {
  useScope("home");
  useBackHandler();

  const { columns } = useResponsive();
  const { navigate } = useNavigation();
  const { handleExit } = useExit();
  const { data: initData, refetch: refreshInit } = useInit();
  const { data: reviewsData } = useReviews();
  const { data: sessionData } = useActiveReviewSession();
  const shutdown = useShutdown();

  const mostRecent = reviewsData?.reviews[0];
  const hasActiveSession = sessionData?.session != null;

  const trustConfig = initData?.project.trust ?? null;
  const projectId = initData?.project.projectId;
  const repoRoot = initData?.project.path;

  const { isTrusted, needsTrust } = deriveTrustStatus({
    trust: trustConfig,
    projectId,
    repoRoot,
  });

  usePageFooter({
    shortcuts: needsTrust ? TRUST_FOOTER_SHORTCUTS : MAIN_MENU_SHORTCUTS,
    rightShortcuts: needsTrust ? TRUST_FOOTER_RIGHT_SHORTCUTS : EMPTY_SHORTCUTS,
  });

  const context: ContextInfo = {
    providerName: initData?.config?.provider ?? undefined,
    providerMode: initData?.config?.model ?? undefined,
    lastRunId: mostRecent?.id,
    lastRunIssueCount: mostRecent?.issueCount,
    trustedDir: isTrusted ? trustConfig?.repoRoot : undefined,
  };

  function handleTrustAccept() {
    refreshInit();
  }

  const onAction = createHomeMenuAction({
    navigate,
    hasActiveSession,
    isTrusted,
    shutdown,
    onExit: handleExit,
  });

  const contentWidth = Math.min(columns, 90);
  const sidebarWidth = Math.min(30, Math.floor(columns * 0.33));

  return (
    <Box justifyContent="center" alignItems="flex-start" flexGrow={1}>
      <Box width={contentWidth}>
        <Box width={sidebarWidth}>
          <ContextSidebar
            context={context}
            isTrusted={isTrusted}
            projectPath={repoRoot ?? undefined}
          />
        </Box>
        <Box flexGrow={1}>
          {needsTrust ? (
            <TrustPanel onAccept={handleTrustAccept} />
          ) : (
            <HomeMenu
              isActive
              onAction={onAction}
              isTrusted={isTrusted}
              hasResumableSession={hasActiveSession}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
