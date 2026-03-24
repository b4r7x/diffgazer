import type { ReactElement } from "react";
import { useNavigation } from "./navigation-context.js";
import type { ScreenName } from "./routes.js";
import { HomeScreen } from "./screens/home-screen.js";
import { ReviewScreen } from "./screens/review-screen.js";
import { HelpScreen } from "./screens/help-screen.js";
import { HistoryScreen } from "./screens/history-screen.js";
import { OnboardingScreen } from "./screens/onboarding-screen.js";
import { SettingsHubScreen } from "./screens/settings/hub-screen.js";
import { ThemeScreen } from "./screens/settings/theme-screen.js";
import { ProvidersScreen } from "./screens/settings/providers-screen.js";
import { StorageScreen } from "./screens/settings/storage-screen.js";
import { AnalysisScreen } from "./screens/settings/analysis-screen.js";
import { AgentExecutionScreen } from "./screens/settings/agent-execution-screen.js";
import { DiagnosticsScreen } from "./screens/settings/diagnostics-screen.js";
import { TrustPermissionsScreen } from "./screens/settings/trust-permissions-screen.js";

export const SCREEN_MAP: Record<ScreenName, () => ReactElement> = {
  "home": () => <HomeScreen />,
  "onboarding": () => <OnboardingScreen />,
  "review": () => <ReviewScreen />,
  "history": () => <HistoryScreen />,
  "help": () => <HelpScreen />,
  "settings": () => <SettingsHubScreen />,
  "settings/theme": () => <ThemeScreen />,
  "settings/providers": () => <ProvidersScreen />,
  "settings/storage": () => <StorageScreen />,
  "settings/analysis": () => <AnalysisScreen />,
  "settings/agent-execution": () => <AgentExecutionScreen />,
  "settings/diagnostics": () => <DiagnosticsScreen />,
  "settings/trust-permissions": () => <TrustPermissionsScreen />,
};

export function ScreenRouter(): ReactElement {
  const { route } = useNavigation();
  const renderScreen = SCREEN_MAP[route.screen];
  return renderScreen();
}
