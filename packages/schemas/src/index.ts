/**
 * Schema Convention: optional() vs nullable()
 *
 * This codebase follows a strict convention for optional and nullable fields:
 *
 * - Use `optional()` when a field CAN BE OMITTED from the object.
 *   The field may or may not exist in the data structure.
 *   Example: `title: z.string().optional()` - title field may not be present
 *
 * - Use `nullable()` when a field MUST BE PRESENT but its value can be null.
 *   The field always exists but may have no meaningful value.
 *   Example: `branch: z.string().nullable()` - branch is always present, but may be null
 *
 * - NEVER use `nullable().optional()` - this creates confusing semantics.
 *   Choose one based on whether the field should always exist in the schema.
 *
 * Guidelines for choosing:
 * - API responses: prefer `nullable()` for consistent response shapes
 * - Request bodies: prefer `optional()` for fields users don't need to provide
 * - Storage schemas: prefer `nullable()` for complete data representation
 * - If both would work semantically, prefer `optional()` (simpler)
 */

export * from "./chat.js";
export * from "./config.js";
export * from "./errors.js";
export * from "./git.js";
export * from "./port.js";
export * from "./review.js";
export * from "./review-history.js";
export * from "./session.js";
