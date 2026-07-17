import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const vitePath = resolve(packageRoot, "node_modules/vite/bin/vite.js");

function buildNotFoundPage(env: Record<string, string>): Document {
  const outDir = mkdtempSync(join(tmpdir(), "diffgazer-landing-build-"));
  try {
    execFileSync(process.execPath, [vitePath, "build", "--outDir", outDir, "--emptyOutDir"], {
      cwd: packageRoot,
      env: { ...process.env, ...env },
      stdio: "pipe",
    });
    return new DOMParser().parseFromString(
      readFileSync(join(outDir, "404.html"), "utf8"),
      "text/html",
    );
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

describe("landing 404 build", () => {
  it("injects the configured recovery links into the built page", () => {
    const page = buildNotFoundPage({
      VITE_DOCS_ORIGIN: "https://docs.example/products/diffgazer",
      VITE_GITHUB_URL: "https://github.example/example/diffgazer",
    });

    expect(page.querySelector('a[href="https://docs.example/products/diffgazer"]')).not.toBeNull();
    expect(page.querySelector('a[href="https://github.example/example/diffgazer"]')).not.toBeNull();
  });

  it("uses the shared fallbacks when configured links have unsafe schemes", () => {
    const page = buildNotFoundPage({
      VITE_DOCS_ORIGIN: "javascript:alert(1)",
      VITE_GITHUB_URL: "data:text/html,hello",
    });

    expect(page.querySelector('a[href="https://docs.b4r7.dev"]')).not.toBeNull();
    expect(page.querySelector('a[href="https://github.com/b4r7x/diffgazer"]')).not.toBeNull();
  });
});
