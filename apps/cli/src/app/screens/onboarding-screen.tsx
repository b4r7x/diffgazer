import type { ReactElement } from "react";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { OnboardingWizard } from "../../features/onboarding/components/onboarding-wizard.js";

export function OnboardingScreen(): ReactElement {
  useScope("onboarding");
  usePageFooter({
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "Enter", label: "Select" },
      { key: "←/→", label: "Navigate Steps" },
    ],
  });

  return <OnboardingWizard />;
}
