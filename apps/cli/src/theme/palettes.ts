export interface CliColorTokens {
  // Primitive
  bg: string;
  fg: string;
  blue: string;
  violet: string;
  green: string;
  red: string;
  yellow: string;
  border: string;
  muted: string;
  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;
  accent: string;
  // Domain (severity)
  severityBlocker: string;
  severityHigh: string;
  severityMedium: string;
  severityLow: string;
  severityNit: string;
  // Domain (status)
  statusRunning: string;
  statusComplete: string;
  statusPending: string;
}

export type Palette = CliColorTokens;

// GitHub Dark Default theme colors
export const darkPalette: Palette = {
  // Primitive
  bg: "#0d1117",
  fg: "#e6edf3",
  blue: "#58a6ff",
  violet: "#bc8cff",
  green: "#3fb950",
  red: "#f85149",
  yellow: "#d29922",
  border: "#30363d",
  muted: "#8b949e",
  // Semantic
  success: "#3fb950",
  warning: "#d29922",
  error: "#f85149",
  info: "#58a6ff",
  accent: "#bc8cff",
  // Domain (severity)
  severityBlocker: "#f85149",
  severityHigh: "#f0883e",
  severityMedium: "#d29922",
  severityLow: "#58a6ff",
  severityNit: "#8b949e",
  // Domain (status)
  statusRunning: "#58a6ff",
  statusComplete: "#3fb950",
  statusPending: "#8b949e",
};

// GitHub Light Default theme colors
export const lightPalette: Palette = {
  // Primitive
  bg: "#ffffff",
  fg: "#1f2328",
  blue: "#0969da",
  violet: "#8250df",
  green: "#1a7f37",
  red: "#cf222e",
  yellow: "#9a6700",
  border: "#d0d7de",
  muted: "#656d76",
  // Semantic
  success: "#1a7f37",
  warning: "#9a6700",
  error: "#cf222e",
  info: "#0969da",
  accent: "#8250df",
  // Domain (severity)
  severityBlocker: "#cf222e",
  severityHigh: "#bc4c00",
  severityMedium: "#9a6700",
  severityLow: "#0969da",
  severityNit: "#656d76",
  // Domain (status)
  statusRunning: "#0969da",
  statusComplete: "#1a7f37",
  statusPending: "#656d76",
};

// High-contrast: bold, maximally distinct colors for accessibility
export const highContrastPalette: Palette = {
  // Primitive
  bg: "#000000",
  fg: "#ffffff",
  blue: "#71b7ff",
  violet: "#e2b5ff",
  green: "#26d95a",
  red: "#ff6a69",
  yellow: "#f0b72f",
  border: "#ffffff",
  muted: "#b3b3b3",
  // Semantic
  success: "#26d95a",
  warning: "#f0b72f",
  error: "#ff6a69",
  info: "#71b7ff",
  accent: "#e2b5ff",
  // Domain (severity)
  severityBlocker: "#ff6a69",
  severityHigh: "#ffab33",
  severityMedium: "#f0b72f",
  severityLow: "#71b7ff",
  severityNit: "#b3b3b3",
  // Domain (status)
  statusRunning: "#71b7ff",
  statusComplete: "#26d95a",
  statusPending: "#b3b3b3",
};

export const palettes: Record<string, Palette> = {
  dark: darkPalette,
  light: lightPalette,
  "high-contrast": highContrastPalette,
};
