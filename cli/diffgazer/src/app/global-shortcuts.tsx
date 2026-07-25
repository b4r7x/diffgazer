import type { ReactElement } from "react";
import { useContext, useEffect, useEffectEvent } from "react";
import { KeyboardContext } from "../hooks/keyboard-context";
import { useExit } from "../hooks/use-exit";
import { useNavigation } from "../hooks/use-navigation";

export function GlobalShortcuts({ onExit }: { onExit: () => void }): null {
  const ctx = useContext(KeyboardContext);
  const { navigate, route } = useNavigation();

  const isGated = route.screen === "onboarding";

  const onKeyboard = useEffectEvent((key: string) => {
    if (isGated) {
      if (key === "q") onExit();
      return;
    }

    switch (key) {
      case "q":
        onExit();
        break;
      case "s":
        if (route.screen !== "settings" && !route.screen.startsWith("settings/")) {
          navigate({ screen: "settings" });
        }
        break;
      case "?":
        if (route.screen !== "help") {
          navigate({ screen: "help" });
        }
        break;
    }
  });

  useEffect(() => {
    if (!ctx) return;

    const unregisterQ = ctx.registerGlobalHandler("q", () => onKeyboard("q"));
    const unregisterS = ctx.registerGlobalHandler("s", () => onKeyboard("s"));
    const unregisterHelp = ctx.registerGlobalHandler("?", () => onKeyboard("?"));

    return () => {
      unregisterQ();
      unregisterS();
      unregisterHelp();
    };
  }, [ctx]);

  return null;
}

export function AppGlobalShortcuts(): ReactElement {
  const { handleExit } = useExit();
  return <GlobalShortcuts onExit={handleExit} />;
}
