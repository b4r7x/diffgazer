import {
  useActiveReviewSession,
  useInit,
  useReviews,
  useShutdown,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import type { ContextInfo, Shortcut } from "@diffgazer/core/schemas/presentation";
import { MAIN_MENU_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import type { ReactElement } from "react";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useExit } from "../../../hooks/use-exit";
import { useNavigation } from "../../../hooks/use-navigation";
import { useScope } from "../../../hooks/use-scope";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { createHomeMenuAction } from "../lib/create-menu-action.js";
import { ContextSidebar } from "./context-sidebar.js";
import { HomeMenu } from "./menu.js";
import { TrustPanel } from "./trust-panel.js";

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

type ResumableSession = {
  reviewId: string;
  mode: "unstaged" | "staged";
};

export function selectResumableSession(
  unstagedSession: { reviewId: string; mode: string } | null | undefined,
  stagedSession: { reviewId: string; mode: string } | null | undefined,
): ResumableSession | null {
  const preferred = unstagedSession ?? stagedSession;
  if (!preferred) {
    return null;
  }
  return preferred.mode === "unstaged" || preferred.mode === "staged"
    ? { reviewId: preferred.reviewId, mode: preferred.mode }
    : null;
}

export function HomeScreen(): ReactElement {
  useScope("home");
  useBackHandler();

  const { columns } = useResponsive();
  const { navigate } = useNavigation();
  const { handleExit } = useExit();
  const { data: initData, refetch: refreshInit } = useInit();
  const { data: reviewsData } = useReviews();
  const { data: unstagedSessionData } = useActiveReviewSession("unstaged");
  const { data: stagedSessionData } = useActiveReviewSession("staged");
  const shutdown = useShutdown();

  const mostRecent = reviewsData?.reviews[0];
  const activeSession = selectResumableSession(
    unstagedSessionData?.session,
    stagedSessionData?.session,
  );
  const hasActiveSession = activeSession != null;

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
    activeSession,
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
