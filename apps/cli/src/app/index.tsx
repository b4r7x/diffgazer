import { useContext, useEffect } from "react";
import type { ReactElement } from "react";
import type { CliMode } from "../types/cli.js";
import { CliThemeProvider } from "../theme/theme-context.js";
import { TerminalKeyboardProvider, KeyboardContext } from "./providers/keyboard-provider.js";
import { NavigationProvider, useNavigation } from "./navigation-context.js";
import { FooterProvider } from "./providers/footer-provider.js";
import { ServerProvider } from "./providers/server-provider.js";
import { GlobalLayout } from "../components/layout/global-layout.js";
import { ScreenRouter } from "./router.js";
import { Toaster } from "../components/ui/toast.js";
import { devServerFactories } from "./modes/dev.js";
import { prodServerFactories } from "./modes/prod.js";

function GlobalShortcuts(): null {
  const ctx = useContext(KeyboardContext);
  const { navigate, route } = useNavigation();

  useEffect(() => {
    if (!ctx) return;

    const unregisterQ = ctx.registerGlobalHandler("q", () => {
      process.exit(0);
    });

    const unregisterS = ctx.registerGlobalHandler("s", () => {
      if (route.screen !== "settings" && !route.screen.startsWith("settings/")) {
        navigate({ screen: "settings" });
      }
    });

    const unregisterHelp = ctx.registerGlobalHandler("?", () => {
      if (route.screen !== "help") {
        navigate({ screen: "help" });
      }
    });

    return () => {
      unregisterQ();
      unregisterS();
      unregisterHelp();
    };
  }, [route.screen]);

  return null;
}

interface AppProps {
  mode: CliMode;
  theme?: string;
}

export function App({ mode, theme }: AppProps): ReactElement {
  const serverFactories =
    mode === "dev" ? devServerFactories : prodServerFactories;

  return (
    <CliThemeProvider initialTheme={theme}>
      <TerminalKeyboardProvider>
        <NavigationProvider>
          <FooterProvider>
            <ServerProvider servers={serverFactories}>
              <GlobalShortcuts />
              <GlobalLayout>
                <ScreenRouter />
              </GlobalLayout>
              <Toaster />
            </ServerProvider>
          </FooterProvider>
        </NavigationProvider>
      </TerminalKeyboardProvider>
    </CliThemeProvider>
  );
}
