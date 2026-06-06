import type { ReactElement } from "react";
import { OnboardingWizard } from "../../features/onboarding/components/wizard";
import { useScope } from "../../hooks/use-scope";

export function OnboardingScreen(): ReactElement {
  useScope("onboarding");
  return <OnboardingWizard />;
}
