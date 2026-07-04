import type { ReactElement } from "react";
import { HelpScreen } from "../features/help/components/screen";
import { HistoryScreen } from "../features/history/components/screen";
import { HomeScreen } from "../features/home/components/screen";
import { OnboardingScreen } from "../features/onboarding/components/screen";
import { ProvidersScreen } from "../features/providers/components/screen";
import { ReviewScreen } from "../features/review/components/screen";
import { AgentExecutionScreen } from "../features/settings/components/agent-execution-screen";
import { AnalysisScreen } from "../features/settings/components/analysis-screen";
import { DiagnosticsScreen } from "../features/settings/components/diagnostics-screen";
import { SettingsHubScreen } from "../features/settings/components/hub-screen";
import { StorageScreen } from "../features/settings/components/storage-screen";
import { ThemeScreen } from "../features/settings/components/theme-screen";
import { TrustPermissionsScreen } from "../features/settings/components/trust-permissions-screen";
import { useNavigation } from "../hooks/use-navigation";
import type { ScreenName } from "../lib/routes";

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
