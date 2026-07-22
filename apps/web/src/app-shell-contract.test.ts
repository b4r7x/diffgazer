import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");
const shellDocument = new DOMParser().parseFromString(indexHtml, "text/html");

describe("app document contract", () => {
  it("allows the rendered shell to consume display-cutout safe areas", () => {
    const viewport = shellDocument.querySelector('meta[name="viewport"]');

    expect(viewport?.getAttribute("content")).toContain("viewport-fit=cover");
  });

  it("declares both supported schemes and a dark first-paint browser color", () => {
    const colorScheme = shellDocument.querySelector('meta[name="color-scheme"]');
    const themeColor = shellDocument.querySelector('meta[name="theme-color"]');

    expect(colorScheme?.getAttribute("content")).toBe("dark light");
    expect(themeColor?.getAttribute("content")).toBe("#0d1117");
  });
});
