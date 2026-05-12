import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export function severityVariant(
  severity: ReviewSeverity,
): "error" | "warning" | "info" | "neutral" {
  switch (severity) {
    case "blocker":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "info";
    case "nit":
      return "neutral";
  }
}
