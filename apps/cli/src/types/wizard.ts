export type WizardMode = "onboarding" | "settings";

export function getWizardFrameProps(mode: WizardMode): { width?: "66%"; centered?: true } {
  return mode === "settings" ? { width: "66%", centered: true } : {};
}
