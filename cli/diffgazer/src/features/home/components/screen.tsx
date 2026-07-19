import {
  useActiveReviewSession,
  useInit,
  useReviews,
  useShutdown,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveTrustStatus, selectResumableSession } from "@diffgazer/core/navigation";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { ContextInfo, Shortcut } from "@diffgazer/core/schemas/presentation";
import { buildHomeContextInfo, MAIN_MENU_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ComponentProps, ReactElement } from "react";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useExit } from "../../../hooks/use-exit";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { createHomeMenuAction } from "../lib/create-menu-action";
import { ContextSidebar } from "./context-sidebar";
import { HomeMenu } from "./menu";
import { TrustPanel } from "./trust-panel";

const RETRY_SHORTCUTS: Shortcut[] = [{ key: "r", label: "Retry" }];

type InitData = NonNullable<ReturnType<typeof useInit>["data"]>;

export function HomeScreen(): ReactElement {
  useBackHandler();

  const { data, error, isLoading, refetch } = useInit();
  if (isLoading) return <HomeLoading />;
  if (error || !data) {
    return (
      <HomeInitError
        message={error?.message ?? "The initialization response was empty."}
        onRetry={() => void refetch()}
      />
    );
  }
  return <LoadedHomeScreen initData={data} onRefresh={() => void refetch()} />;
}

function HomeLoading(): ReactElement {
  usePageFooter({ shortcuts: [] });
  return (
    <Box flexGrow={1} alignItems="center" justifyContent="center">
      <Spinner label="Loading home data..." />
    </Box>
  );
}

function HomeInitError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { tokens } = useTheme();
  useInput((input) => {
    if (input === "r") onRetry();
  });
  usePageFooter({ shortcuts: RETRY_SHORTCUTS });

  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Text color={tokens.error}>Home Data Unavailable</Text>
      <Text dimColor>{sanitizeTerminalText(message)}</Text>
      <Text dimColor>Press r to retry</Text>
    </Box>
  );
}

function LoadedHomeScreen({ initData, onRefresh }: { initData: InitData; onRefresh: () => void }) {
  const { columns, isNarrow } = useResponsive();
  const { navigate } = useNavigation();
  const { handleExit } = useExit();
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

  const context: ContextInfo = buildHomeContextInfo(
    {
      provider: initData?.config?.provider,
      model: initData?.config?.model,
      trustedRepoRoot: trustConfig?.repoRoot,
    },
    mostRecent,
    isTrusted,
  );

  function handleTrustAccept() {
    onRefresh();
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
  const sidebarWidth = isNarrow ? contentWidth : Math.min(30, Math.floor(columns * 0.33));

  return (
    <Box justifyContent="center" alignItems="flex-start" flexGrow={1}>
      <Box width={contentWidth} flexDirection={isNarrow ? "column" : "row"}>
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
            <HomeMenuWithFooter
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

function HomeMenuWithFooter(props: ComponentProps<typeof HomeMenu>): ReactElement {
  usePageFooter({ shortcuts: MAIN_MENU_SHORTCUTS });
  return <HomeMenu {...props} />;
}
