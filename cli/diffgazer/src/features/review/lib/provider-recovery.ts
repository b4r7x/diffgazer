import type { Shortcut } from "@diffgazer/core/schemas/presentation";

/**
 * A review failure fixed on the providers screen publishes one key, `p` — the
 * review gates' own Providers key, clear of the global `s` — named by the same
 * CTA label the web button carries; the callout repeats it as a line.
 */
export const PROVIDER_RECOVERY_KEY = "p";

export function getProviderRecoveryShortcut(label: string): Shortcut {
  return { key: PROVIDER_RECOVERY_KEY, label };
}

export function getProviderRecoveryLine(label: string): string {
  return `Press ${PROVIDER_RECOVERY_KEY} — ${label}.`;
}
