import type { ReactElement } from "react";
import { useScope } from "../../hooks/use-scope";
import { OnboardingWizard } from "../../features/onboarding/components/onboarding-wizard";

export function OnboardingScreen(): ReactElement {
  useScope("onboarding");
  return <OnboardingWizard />;
}
