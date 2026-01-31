import type { ReactElement } from "react";
import { useApp } from "ink";
import { useScreenState } from "../../hooks/use-screen-state.js";
import { MAIN_MENU_SHORTCUTS } from "@repo/core";
import type { MenuAction } from "../../lib/navigation.js";
import { ContextSidebar, HomeMenu, type ContextInfo } from "../../features/home/components/index.js";
import { SplitPane } from "../../components/ui/layout/index.js";
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
  const [selectedIndex, setSelectedIndex] = useScreenState("selectedIndex", 0);
  const { isNarrow } = useTerminalDimensions();

  // Fixed widths for consistent menu sizing
  const gap = 3;
  const leftWidth = 40;
  const rightWidth = 32;

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
      leftWidth={isNarrow ? undefined : leftWidth}
      rightWidth={isNarrow ? undefined : rightWidth}
      gap={gap}
    >
      <ContextSidebar context={contextInfo} />
      <HomeMenu
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onActivate={handleActivate}
        hasLastReview={hasLastReview}
        isActive={isActive}
        width={rightWidth}
      />
    </SplitPane>
  );
}
