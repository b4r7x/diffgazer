export type { Result } from "./result.js";
export { ok, err } from "./result.js";
export type { AppError } from "./errors.js";
export { createError, getErrorMessage, isAbortError } from "./errors.js";
export {
  createErrorClassifier,
  createErrorState,
  isValidUuid,
  validateSchema,
  isRelativePath,
  isValidProjectPath,
} from "./utils/index.js";
export { safeParseJson } from "./json.js";
export { sanitizeUnicode, escapeXml } from "./sanitization.js";
export { formatRelativeTime, getScoreColor } from "./format.js";
// NOTE: fs operations (safeReadFile, atomicWriteFile, ensureDirectory) are NOT exported here
// They use node:fs/promises which breaks browser bundles. Use @repo/core/storage for server-side file ops.
export {
  parseSSEStream,
  type SSEParserOptions,
  type SSEParseResult,
} from "./streaming/index.js";

export { truncate, truncateToDisplayLength } from "./string.js";
export { chunk } from "./array.js";
export { parsePort, parsePortOrDefault } from "./port.js";
export * from "./navigation/index.js";
export {
  useRouteState,
  clearRouteState,
  getRouteStateSize,
} from "./hooks/use-route-state.js";
