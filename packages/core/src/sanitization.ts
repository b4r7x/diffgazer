/**
 * Remove potentially problematic unicode characters from text.
 * Removes zero-width characters, tag characters, bidirectional overrides,
 * and variation selectors that could cause display issues or security concerns.
 */
export function sanitizeUnicode(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")       // Zero-width characters
    .replace(/[\u{E0000}-\u{E007F}]/gu, "")      // Tag characters
    .replace(/[\u202A-\u202E]/g, "")              // Bidirectional overrides
    .replace(/[\uFE00-\uFE0F]/g, "");             // Variation selectors
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
