import {
  useActiveReviewSession,
  useConfigurationInit,
  useProviderConsentGate,
  useReviews,
  useShutdown,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveTrustStatus, selectResumableSession } from "@diffgazer/core/navigation";
import { getCatalogModelName, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { resolveSelectedConfiguration } from "@diffgazer/core/schemas/config";
import type { HomeContextInfo, MenuAction, Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  buildHomeContextInfo,
  MAIN_MENU_SHORTCUTS,
  resolveLastRunRequest,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { ProviderConsentOverlay } from "../../../components/shared/provider-consent-overlay";
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

// The file-scope key is this surface's own row on the bar: it follows the keys
// every menu publishes, so a terminal too narrow for all four drops the extra
// one rather than Quit.
const HOME_SHORTCUTS: Shortcut[] = [...MAIN_MENU_SHORTCUTS, { key: "f", label: "Review Files" }];

type InitData = NonNullable<ReturnType<typeof useConfigurationInit>["data"]>;

export function HomeScreen(): ReactElement {
  useBackHandler();

  const { data, error, isLoading, refetch } = useConfigurationInit();
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
      <Text color={tokens.muted}>{sanitizeTerminalText(message)}</Text>
      <Text color={tokens.muted}>Press r to retry</Text>
    </Box>
  );
}

function LoadedHomeScreen({ initData, onRefresh }: { initData: InitData; onRefresh: () => void }) {
  const { columns, isNarrow } = useResponsive();
  const { navigate } = useNavigation();
  const { handleExit } = useExit();
  const reviewsQuery = useReviews();
  const { data: unstagedSessionData } = useActiveReviewSession("unstaged");
  const { data: stagedSessionData } = useActiveReviewSession("staged");
  const shutdown = useShutdown();
  // The first review asks for the provider consent once, before anything is sent.
  const consent = useProviderConsentGate(initData.settings.providerConsent);
  // Screen state, not the menu's: the notice overlay replaces the home frame, and
  // the row it was opened from must still be highlighted when the frame is back.
  const [highlightedId, setHighlightedId] = useState<MenuAction | null>(null);

  const mostRecent = reviewsQuery.data?.reviews[0];
  const activeSession = selectResumableSession(
    unstagedSessionData?.session,
    stagedSessionData?.session,
  );
  const hasActiveSession = activeSession != null;

  const trustConfig = initData.project.trust ?? null;
  const projectId = initData.project.projectId;
  const repoRoot = initData.project.path;

  const { isTrusted, needsTrust } = deriveTrustStatus({
    trust: trustConfig,
    projectId,
    repoRoot,
  });

  const selected = resolveSelectedConfiguration(initData);
  const provider = selected
    ? PRODUCT_REGISTRY[selected.configuration.productId].presentation.name
    : undefined;
  const model = selected?.configuration.selectedModelId
    ? getCatalogModelName(selected.configuration.productId, selected.configuration.selectedModelId)
    : undefined;

  const context: HomeContextInfo = buildHomeContextInfo(
    {
      provider,
      model,
      trustedRepoRoot: trustConfig?.repoRoot,
    },
    mostRecent,
    isTrusted,
    resolveLastRunRequest(reviewsQuery),
  );

  function handleTrustAccept() {
    onRefresh();
  }

  const onAction = createHomeMenuAction({
    navigate,
    activeSession,
    isTrusted,
    requireProviderConsent: consent.require,
    shutdown,
    onExit: handleExit,
  });

  // The sidebar carries paths, provider ids and run ids: it gets a share of the
  // frame that grows with it instead of a fixed 30 columns that elides at 100.
  const contentWidth = Math.min(columns - 4, 120);
  const sidebarWidth = isNarrow
    ? contentWidth
    : Math.min(Math.max(Math.floor(contentWidth * 0.38), 28), 44);

  // Side by side the two panes share the full frame height. Stacked they must
  // not: a full-height context pane would eat the viewport and leave the menu
  // as a border sliver, so there the context keeps its content height and only
  // the menu takes the slack.
  const paneHeight = isNarrow ? undefined : "100%";

  // Picking files starts a review, so the key answers to the trust gate the
  // menu's review rows answer to, and stands down while the consent notice owns
  // the frame.
  useInput(
    (input) => {
      if (input === "f") navigate({ screen: "review", pickFiles: true });
    },
    { isActive: isTrusted && !consent.isOpen },
  );

  if (consent.isOpen) return <ProviderConsentOverlay gate={consent} />;

  return (
    <Box justifyContent="center" alignItems="stretch" flexGrow={1}>
      <Box width={contentWidth} flexDirection={isNarrow ? "column" : "row"}>
        {/* The menu panel fills its row, so an elastic sidebar would be shrunk
            back below the budget the clamp just granted it. */}
        <Box width={sidebarWidth} flexShrink={0} height={paneHeight}>
          <ContextSidebar
            context={context}
            isTrusted={isTrusted}
            projectPath={repoRoot ?? undefined}
          />
        </Box>
        <Box flexGrow={1} minWidth={40} height={paneHeight}>
          {needsTrust ? (
            <TrustPanel onAccept={handleTrustAccept} />
          ) : (
            <>
              <MainMenuFooter />
              <HomeMenu
                isActive
                highlightedId={highlightedId}
                onHighlightChange={setHighlightedId}
                onAction={onAction}
                isTrusted={isTrusted}
                hasResumableSession={hasActiveSession}
              />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Branch-scoped footer publisher: it unmounts when the trust panel takes over
 * the menu column, so the panel's own `usePageFooter` owns the bar instead of
 * being overwritten by a parent effect on the same commit.
 */
function MainMenuFooter(): null {
  usePageFooter({ shortcuts: HOME_SHORTCUTS });
  return null;
}
