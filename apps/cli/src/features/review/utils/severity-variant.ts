export function severityVariant(
  severity: string,
): "error" | "warning" | "info" | "neutral" {
  switch (severity) {
    case "blocker":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}
