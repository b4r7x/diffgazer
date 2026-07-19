import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");
describe("app document contract", () => {
  it("allows the rendered shell to consume display-cutout safe areas", () => {
    expect(indexHtml).toMatch(/name="viewport"[\s\S]*viewport-fit=cover/);
  });

  it("declares both supported schemes and a dark first-paint browser color", () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark light" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0d1117" />');
  });
});
