import { describe, it, expect } from "vitest";
import { escapeXml, sanitizeUnicode } from "./sanitization.js";

describe("escapeXml", () => {
  it("escapes less-than signs", () => {
    expect(escapeXml("<script>")).toBe("&lt;script&gt;");
    expect(escapeXml("<")).toBe("&lt;");
  });

  it("escapes greater-than signs", () => {
    expect(escapeXml(">")).toBe("&gt;");
    expect(escapeXml("a > b")).toBe("a &gt; b");
  });

  it("escapes ampersands", () => {
    expect(escapeXml("&")).toBe("&amp;");
    expect(escapeXml("rock & roll")).toBe("rock &amp; roll");
  });

  it("escapes combined XML special characters", () => {
    expect(escapeXml("<div>&test</div>")).toBe(
      "&lt;div&gt;&amp;test&lt;/div&gt;"
    );
    expect(escapeXml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("escapes ampersands first to prevent double-escaping", () => {
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });

  it("returns safe strings unchanged", () => {
    expect(escapeXml("hello world")).toBe("hello world");
    expect(escapeXml("safe text")).toBe("safe text");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("preserves numbers and special chars that don't need escaping", () => {
    expect(escapeXml("123")).toBe("123");
    expect(escapeXml("hello-world_test")).toBe("hello-world_test");
    expect(escapeXml("price: $99.99")).toBe("price: $99.99");
    expect(escapeXml("email@example.com")).toBe("email@example.com");
  });

  it("handles script tag injection attempts", () => {
    expect(escapeXml("<script>alert('XSS')</script>")).toBe(
      "&lt;script&gt;alert('XSS')&lt;/script&gt;"
    );
  });

  it("handles prompt injection patterns (CVE-2025-53773)", () => {
    expect(escapeXml("<|system|>")).toBe("&lt;|system|&gt;");
    expect(escapeXml("</instructions>")).toBe("&lt;/instructions&gt;");
    expect(escapeXml("<thinking>malicious</thinking>")).toBe(
      "&lt;thinking&gt;malicious&lt;/thinking&gt;"
    );
  });
});

describe("sanitizeUnicode", () => {
  it("strips zero-width space characters", () => {
    expect(sanitizeUnicode("hello\u200Bworld")).toBe("helloworld");
    expect(sanitizeUnicode("\u200Btest\u200B")).toBe("test");
  });

  it("strips zero-width joiner and non-joiner", () => {
    expect(sanitizeUnicode("test\u200Cword")).toBe("testword");
    expect(sanitizeUnicode("test\u200Dword")).toBe("testword");
  });

  it("strips BOM (Byte Order Mark)", () => {
    expect(sanitizeUnicode("\uFEFFhello")).toBe("hello");
    expect(sanitizeUnicode("hello\uFEFF")).toBe("hello");
    expect(sanitizeUnicode("\uFEFFhello\uFEFF")).toBe("hello");
  });

  it("strips directional override characters", () => {
    expect(sanitizeUnicode("test\u202Emalicious")).toBe("testmalicious");
    expect(sanitizeUnicode("\u202Atext\u202B")).toBe("text");
    expect(sanitizeUnicode("\u202Ctext\u202D")).toBe("text");
  });

  it("strips tag characters from Unicode planes", () => {
    expect(sanitizeUnicode("hello\u{E0001}world")).toBe("helloworld");
  });

  it("strips variation selectors", () => {
    expect(sanitizeUnicode("test\uFE00word")).toBe("testword");
    expect(sanitizeUnicode("test\uFE0Fword")).toBe("testword");
  });

  it("keeps normal text unchanged", () => {
    expect(sanitizeUnicode("hello world")).toBe("hello world");
    expect(sanitizeUnicode("normal text")).toBe("normal text");
    expect(sanitizeUnicode("123 ABC")).toBe("123 ABC");
  });

  it("preserves emojis", () => {
    expect(sanitizeUnicode("🎉")).toBe("🎉");
    expect(sanitizeUnicode("hello 🎉 world")).toBe("hello 🎉 world");
    expect(sanitizeUnicode("✨🚀💯")).toBe("✨🚀💯");
  });

  it("preserves accented characters", () => {
    expect(sanitizeUnicode("café")).toBe("café");
    expect(sanitizeUnicode("naïve")).toBe("naïve");
    expect(sanitizeUnicode("résumé")).toBe("résumé");
    expect(sanitizeUnicode("São Paulo")).toBe("São Paulo");
  });

  it("preserves CJK characters", () => {
    expect(sanitizeUnicode("你好")).toBe("你好");
    expect(sanitizeUnicode("こんにちは")).toBe("こんにちは");
    expect(sanitizeUnicode("안녕하세요")).toBe("안녕하세요");
  });

  it("handles empty string", () => {
    expect(sanitizeUnicode("")).toBe("");
  });

  it("handles multiple invisible characters", () => {
    expect(sanitizeUnicode("\u200B\uFEFF\u202E\uFE00test")).toBe("test");
    expect(sanitizeUnicode("clean\u200B\uFEFF\u202E\uFE00text")).toBe(
      "cleantext"
    );
  });

  it("handles security attacks with hidden characters", () => {
    expect(sanitizeUnicode("admin\u202E\u202Dadmin")).toBe("adminadmin");
    expect(sanitizeUnicode("file\u200B.exe")).toBe("file.exe");
  });
});
