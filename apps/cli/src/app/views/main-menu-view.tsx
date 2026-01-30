import type { ReactElement } from "react";
import { Box, useApp } from "ink";
import { useRouteState, type MenuAction, MAIN_MENU_SHORTCUTS } from "@repo/core";
import { HeaderBrand } from "../../components/ui/header-brand.js";
import { FooterBarWithDivider, type Shortcut } from "../../components/ui/footer-bar.js";
import { ContextSidebar, HomeMenu, type ContextInfo } from "../../features/home/index.js";

export type { MenuAction };

const FOOTER_SHORTCUTS: Shortcut[] = MAIN_MENU_SHORTCUTS.map((s) => ({
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

  const contextInfo: ContextInfo = {
    trustedDir: isTrusted ? "Trusted" : undefined,
    providerName: provider !== "Not configured" ? provider : undefined,
    providerMode: model,
    lastRunId: lastReviewAt ?? undefined,
    lastRunIssueCount: undefined,
  };

  const handleActivate = (id: string) => {
    if (id === "quit") {
      exit();
    } else {
      onSelect?.(id as MenuAction);
    }
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <HeaderBrand showStars={true} />

      <Box flexDirection="row" marginTop={1} marginBottom={1} gap={2}>
        <Box width={40}>
          <ContextSidebar context={contextInfo} />
        </Box>
        <Box flexGrow={1}>
          <HomeMenu
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={handleActivate}
            hasLastReview={hasLastReview}
            isActive={isActive}
          />
        </Box>
      </Box>

      <FooterBarWithDivider shortcuts={FOOTER_SHORTCUTS} />
    </Box>
  );
}
