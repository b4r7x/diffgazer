/**
 * Helper functions for creating common state objects.
 */

/**
 * Creates a standardized error state object.
 *
 * @param message - The error message to display
 * @param code - The error code (defaults to "INTERNAL_ERROR")
 * @returns An error state object with status, message, and code
 *
 * @example
 * // Default INTERNAL_ERROR code
 * createErrorState("Something went wrong")
 * // => { status: "error", error: { message: "Something went wrong", code: "INTERNAL_ERROR" } }
 *
 * @example
 * // Custom error code
 * createErrorState("Not found", "SESSION_NOT_FOUND")
 * // => { status: "error", error: { message: "Not found", code: "SESSION_NOT_FOUND" } }
 */
export function createErrorState<TCode extends string = "INTERNAL_ERROR">(
  message: string,
  code: TCode = "INTERNAL_ERROR" as TCode
) {
  return { status: "error" as const, error: { message, code } };
}
