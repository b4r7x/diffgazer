import type { ReactElement } from "react";
import { useNavigation } from "./navigation-context";
import type { ScreenName } from "./routes";
import { HomeScreen } from "./screens/home-screen";
import { ReviewScreen } from "./screens/review-screen";
import { HelpScreen } from "./screens/help-screen";
import { HistoryScreen } from "./screens/history-screen";
import { OnboardingScreen } from "./screens/onboarding-screen";
import { SettingsHubScreen } from "./screens/settings/hub-screen";
import { ThemeScreen } from "./screens/settings/theme-screen";
import { ProvidersScreen } from "./screens/settings/providers-screen";
import { StorageScreen } from "./screens/settings/storage-screen";
import { AnalysisScreen } from "./screens/settings/analysis-screen";
import { AgentExecutionScreen } from "./screens/settings/agent-execution-screen";
import { DiagnosticsScreen } from "./screens/settings/diagnostics-screen";
import { TrustPermissionsScreen } from "./screens/settings/trust-permissions-screen";

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
