import { redactSecrets } from "@diffgazer/core/redaction";

/**
 * Plain-text report for the root crash screen's copy action. The raw error is
 * never rendered on screen; this is the one place its detail leaves the app,
 * so route, name, message, and stack all pass through the shared redaction
 * battery before they can reach a clipboard or an issue tracker.
 */
export function buildCrashReport(error: Error, rawRoute: string, crashedAt: Date): string {
  const lines = [
    "diffgazer crash report",
    `time: ${crashedAt.toISOString()}`,
    `route: ${redactSecrets(rawRoute, [])}`,
    `error: ${redactSecrets(error.name, [])}`,
    `message: ${redactSecrets(error.message, [])}`,
  ];
  if (error.stack) {
    lines.push(`stack: ${redactSecrets(error.stack, [])}`);
  }
  return lines.join("\n");
}
