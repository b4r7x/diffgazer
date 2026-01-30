export type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

export const SEVERITY_ICONS: Record<SeverityLevel, string> = {
  blocker: "X",
  high: "!",
  medium: "-",
  low: ".",
  nit: "~",
};
