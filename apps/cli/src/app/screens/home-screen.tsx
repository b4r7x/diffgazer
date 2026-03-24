import { useState } from "react";
import type { ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
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
  const [needsTrust, setNeedsTrust] = useState(false);

  function handleTrustAccept(_caps: { readFiles: boolean; runCommands: boolean }) {
    // TODO: persist trust capabilities
    setNeedsTrust(false);
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
        navigate({ screen: "review" });
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
        process.exit(0);
        break;
    }
  };

  const trustStatus = needsTrust ? "untrusted" : "unknown";

  return (
    <Box>
      <Box width={30}>
        <ContextSidebar providerName="—" trustStatus={trustStatus} />
      </Box>
      <Box flexGrow={1}>
        {needsTrust ? (
          <TrustPanel onAccept={handleTrustAccept} />
        ) : (
          <HomeMenu isActive onAction={onAction} />
        )}
      </Box>
    </Box>
  );
}
