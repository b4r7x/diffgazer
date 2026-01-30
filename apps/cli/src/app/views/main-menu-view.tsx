import type { ReactElement } from "react";
import { useApp } from "ink";
import { type MenuAction, MAIN_MENU_SHORTCUTS } from "@repo/core";
import { useRouteState } from "@repo/hooks";
import { ContextSidebar, HomeMenu, type ContextInfo } from "../../features/home/index.js";
import { SplitPane } from "../../components/ui/split-pane.js";
import { useTerminalDimensions } from "../../hooks/index.js";
import type { Shortcut } from "@repo/schemas/ui";

export type { MenuAction };

export const MAIN_MENU_FOOTER_SHORTCUTS: Shortcut[] = MAIN_MENU_SHORTCUTS.map((s) => ({
  key: s.key,
  label: s.label.toLowerCase(),
}));

interface MainMenuViewProps {
  provider?: string;
  model?: string;
  isTrusted?: boolean;
  lastReviewAt?: string | null;
  hasLastReview?: boolean;
  onSelect?: (action: MenuAction) => void;
  isActive?: boolean;
}

export function MainMenuView({
  provider = "Not configured",
  model,
  isTrusted = false,
  lastReviewAt,
  hasLastReview = false,
  onSelect,
  isActive = true,
}: MainMenuViewProps): ReactElement {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useRouteState("mainMenu.selectedIndex", 0);
  const { isNarrow } = useTerminalDimensions();

  const contextInfo: ContextInfo = {
    trustedDir: isTrusted ? "Trusted" : undefined,
    providerName: provider !== "Not configured" ? provider : undefined,
    providerMode: model,
    lastRunId: lastReviewAt ?? undefined,
  };

  const handleActivate = (id: string) => {
    if (id === "quit") {
      exit();
    } else {
      onSelect?.(id as MenuAction);
    }
  };

  return (
    <SplitPane
      center={!isNarrow}
      leftWidth={isNarrow ? undefined : 30}
      rightWidth={isNarrow ? undefined : 50}
      gap={3}
    >
      <ContextSidebar context={contextInfo} />
      <HomeMenu
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onActivate={handleActivate}
        hasLastReview={hasLastReview}
        isActive={isActive}
      />
    </SplitPane>
  );
}
