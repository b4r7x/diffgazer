import type { ReactElement } from "react";
import { HelpScreen } from "../features/help/components/screen.js";
import { HistoryScreen } from "../features/history/components/screen.js";
import { HomeScreen } from "../features/home/components/screen.js";
import { OnboardingScreen } from "../features/onboarding/components/screen.js";
import { ProvidersScreen } from "../features/providers/components/providers-screen.js";
import { ReviewScreen } from "../features/review/components/screen.js";
import { AgentExecutionScreen } from "../features/settings/components/agent-execution-screen.js";
import { AnalysisScreen } from "../features/settings/components/analysis-screen.js";
import { DiagnosticsScreen } from "../features/settings/components/diagnostics-screen.js";
import { SettingsHubScreen } from "../features/settings/components/hub-screen.js";
import { StorageScreen } from "../features/settings/components/storage-screen.js";
import { ThemeScreen } from "../features/settings/components/theme-screen.js";
import { TrustPermissionsScreen } from "../features/settings/components/trust-permissions-screen.js";
import { useNavigation } from "../hooks/use-navigation";
import type { ScreenName } from "../lib/routes.js";

const SCREEN_MAP: Record<ScreenName, () => ReactElement> = {
  home: () => <HomeScreen />,
  onboarding: () => <OnboardingScreen />,
  review: () => <ReviewScreen />,
  history: () => <HistoryScreen />,
  help: () => <HelpScreen />,
  settings: () => <SettingsHubScreen />,
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
