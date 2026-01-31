export function sanitizeUnicode(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u{E0000}-\u{E007F}]/gu, "")
    .replace(/[\u202A-\u202E]/g, "")
    .replace(/[\uFE00-\uFE0F]/g, "");
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
