import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(import.meta.dirname, "index.html"), "utf8");
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

  it("links the shared diffgazer icon set and ships every file it names", () => {
    const iconLinks = [
      ...shellDocument.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]'),
    ];
    const hrefs = ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"];

    expect(iconLinks.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    for (const href of hrefs) {
      expect(existsSync(join(import.meta.dirname, "public", href)), href).toBe(true);
    }

    const favicon = readFileSync(join(import.meta.dirname, "public/favicon.svg"), "utf8");
    const sharedMark = readFileSync(
      join(import.meta.dirname, "../../libs/ui/brand/diffgazer-mark.svg"),
      "utf8",
    );
    expect(favicon).toContain(`d="${sharedMark.match(/ d="([^"]+)"/)?.[1]}"`);
  });
});
