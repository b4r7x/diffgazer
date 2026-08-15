import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const vitePath = resolve(packageRoot, "node_modules/vite/bin/vite.js");

interface BuiltPages {
  index: Document;
  notFound: Document;
}

function buildPages(env: Record<string, string>): BuiltPages {
  const outDir = mkdtempSync(join(tmpdir(), "diffgazer-landing-build-"));
  try {
    execFileSync(process.execPath, [vitePath, "build", "--outDir", outDir, "--emptyOutDir"], {
      cwd: packageRoot,
      env: { ...process.env, ...env },
      stdio: "pipe",
    });
    const parse = (name: string): Document =>
      new DOMParser().parseFromString(readFileSync(join(outDir, name), "utf8"), "text/html");
    return { index: parse("index.html"), notFound: parse("404.html") };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

describe("landing link build", () => {
  it("injects the configured links into both built pages", () => {
    const { index, notFound } = buildPages({
      VITE_DOCS_ORIGIN: "https://docs.example/products/diffgazer",
      VITE_GITHUB_URL: "https://github.example/example/diffgazer",
    });

    expect(
      notFound.querySelector('a[href="https://docs.example/products/diffgazer"]'),
    ).not.toBeNull();
    expect(
      notFound.querySelector('a[href="https://github.example/example/diffgazer"]'),
    ).not.toBeNull();
    expect(index.querySelector('a[href="https://docs.example/products/diffgazer"]')).not.toBeNull();
    expect(
      index.querySelector('a[href="https://github.example/example/diffgazer"]'),
    ).not.toBeNull();
    expect(
      index.querySelector('a[href="https://github.example/example/diffgazer/blob/main/LICENSE"]'),
    ).not.toBeNull();
    expect(index.querySelector("a[href*='%VITE_']")).toBeNull();
  });

  it("uses the shared fallbacks when configured links have unsafe schemes", () => {
    const { index, notFound } = buildPages({
      VITE_DOCS_ORIGIN: "javascript:alert(1)",
      VITE_GITHUB_URL: "data:text/html,hello",
    });

    expect(notFound.querySelector('a[href="https://docs.b4r7.dev"]')).not.toBeNull();
    expect(notFound.querySelector('a[href="https://github.com/b4r7x/diffgazer"]')).not.toBeNull();
    expect(index.querySelector('a[href="https://docs.b4r7.dev"]')).not.toBeNull();
    expect(index.querySelector('a[href="https://github.com/b4r7x/diffgazer"]')).not.toBeNull();
  });
});
