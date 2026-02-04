export const sanitizeUnicode = (value: string): string =>
  value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u{E0000}-\u{E007F}]/gu, "")
    .replace(/[\u202A-\u202E]/g, "")
    .replace(/[\uFE00-\uFE0F]/g, "");

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
