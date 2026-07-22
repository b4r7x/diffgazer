import { describe, expect, it } from "vitest";
import { kebabToCamelCase, toDocExportName, toYamlString } from "./naming.js";

describe("kebabToCamelCase", () => {
  it("converts kebab-case to camelCase", () => {
    expect(kebabToCamelCase("use-active-heading")).toBe("useActiveHeading");
  });

  it("returns single-word strings unchanged", () => {
    expect(kebabToCamelCase("button")).toBe("button");
  });
});

describe("toDocExportName", () => {
  it("appends Doc suffix to camelCase name", () => {
    expect(toDocExportName("use-scroll-lock")).toBe("useScrollLockDoc");
  });
});

describe("toYamlString", () => {
  it("returns JSON-encoded string with double quotes", () => {
    expect(toYamlString("hello world")).toBe('"hello world"');
  });

  it("escapes special characters", () => {
    expect(toYamlString('say "hi"')).toBe('"say \\"hi\\""');
  });
});
