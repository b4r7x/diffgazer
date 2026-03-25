import type { StepState } from "@diffgazer/schemas/events";

export function isNoDiffError(error: string | null): boolean {
  return (
    error?.includes("No staged changes") === true ||
    error?.includes("No unstaged changes") === true
  );
}

export function isCheckingForChanges(isStreaming: boolean, steps: StepState[]): boolean {
  const diffStep = steps.find((s) => s.id === "diff");
  return isStreaming && diffStep?.status !== "completed" && diffStep?.status !== "error";
}

export function getLoadingMessage(opts: {
  configLoading: boolean;
  settingsLoading: boolean;
  isCheckingForChanges: boolean;
  isInitializing: boolean;
}): string | null {
  if (opts.configLoading || opts.settingsLoading) return "Loading configuration...";
  if (opts.isCheckingForChanges || opts.isInitializing) return "Checking for changes...";
  return null;
}
