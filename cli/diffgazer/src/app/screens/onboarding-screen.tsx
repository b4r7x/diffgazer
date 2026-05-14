import type { ReactElement } from "react";
import { useScope } from "../../hooks/use-scope.js";
import { OnboardingWizard } from "../../features/onboarding/components/onboarding-wizard.js";

export function OnboardingScreen(): ReactElement {
  useScope("onboarding");
  return <OnboardingWizard />;
}
