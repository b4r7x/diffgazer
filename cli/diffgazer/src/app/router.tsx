import type { ReactElement } from "react";
import { useNavigation } from "./providers/navigation-provider";
import type { ScreenName } from "./routes";
import { HelpScreen } from "./screens/help";
import { HistoryScreen } from "./screens/history";
import { HomeScreen } from "./screens/home";
import { OnboardingScreen } from "./screens/onboarding";
import { ReviewScreen } from "./screens/review";
import { AgentExecutionScreen } from "./screens/settings/agent-execution";
import { AnalysisScreen } from "./screens/settings/analysis";
import { DiagnosticsScreen } from "./screens/settings/diagnostics";
import { SettingsHubScreen } from "./screens/settings/hub";
import { ProvidersScreen } from "./screens/settings/providers";
import { StorageScreen } from "./screens/settings/storage";
import { ThemeScreen } from "./screens/settings/theme";
import { TrustPermissionsScreen } from "./screens/settings/trust-permissions";

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
