// Result type for error handling
export type { Result } from "./result.js";
export { ok, err } from "./result.js";

// Error utilities
export type { AppError } from "./errors.js";
export { createError, getErrorMessage, isAbortError, isNodeError, toError } from "./errors.js";

// Constants
export { APP_NAME, DEFAULT_TTL, DEFAULT_TRUST_CAPABILITIES } from "./constants.js";

// String utilities
export { capitalize, truncate, truncateToDisplayLength } from "./strings.js";

// Network constants
export { DEFAULT_HOST } from "./network.js";

// Severity calculations and display constants
export {
  calculateSeverityCounts,
  SEVERITY_ORDER,
  SEVERITY_LABELS,
  SEVERITY_ICONS,
  SEVERITY_COLORS,
  HISTOGRAM_SEVERITIES,
  type SeverityCounts,
} from "./severity.js";

// Formatting utilities (shared only)
export { formatTime, formatTimestamp, type TimerFormat } from "./format.js";

// SSE streaming
export {
  parseSSEStream,
  type SSEParserOptions,
  type SSEParseResult,
} from "./streaming/index.js";

// JSON parsing
export { safeParseJson } from "./json.js";

// Navigation (menu items, shortcuts)
export type { MenuAction, MenuItem, SettingsAction, SettingsMenuItem } from "./navigation.js";
export { MENU_ITEMS, SETTINGS_MENU_ITEMS, MAIN_MENU_SHORTCUTS, SETTINGS_SHORTCUTS } from "./navigation.js";

// List navigation utilities
export type { VisibleWindow, CalculateVisibleWindowOptions } from "./list.js";
export { calculateVisibleWindow, findNextEnabled, findPrevEnabled } from "./list.js";

