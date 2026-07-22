import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REGISTRY_ORIGIN } from "./constants.js";
import { normalizeOrigin, resolveRegistryRoute } from "./origin.js";
import { buildShadcnRegistryWithOrigin } from "./shadcn/build.js";

let fixtureDir: string | null = null;

afterEach(() => {
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  fixtureDir = null;
});

describe("normalizeOrigin", () => {
  it("uses the canonical registry origin by default", () => {
    expect(normalizeOrigin(undefined)).toBe(REGISTRY_ORIGIN);
  });

  it("trims trailing slashes", () => {
    expect(normalizeOrigin("https://example.com/registry///")).toBe("https://example.com/registry");
  });

  it("rejects non-http origins", () => {
    expect(() => normalizeOrigin("ftp://example.com")).toThrow(/hosted http\(s\) URL/);
  });

  it.each([
    "https://",
    "https://example.com/registry?preview=1",
    "https://example.com/registry?",
    "https://example.com/registry#preview",
    "https://example.com/registry#",
    "https://user:password@example.com/registry",
  ])("rejects unsafe registry origin %s", (origin) => {
    expect(() => normalizeOrigin(origin)).toThrow(/REGISTRY_ORIGIN must be a hosted http\(s\) URL/);
  });

  it("keeps the path prefix through a successful registry build", () => {
    fixtureDir = mkdtempSync(resolve(tmpdir(), "diffgazer-origin-build-"));
    const binDir = resolve(fixtureDir, "node_modules/.bin");
    const registryDir = resolve(fixtureDir, "registry");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(registryDir, { recursive: true });
    const shadcnBin = resolve(binDir, "shadcn");
    writeFileSync(shadcnBin, "#!/bin/sh\nexit 0\n");
    chmodSync(shadcnBin, 0o755);
    writeFileSync(resolve(registryDir, "registry.json"), '{"items":[]}\n');

    const result = buildShadcnRegistryWithOrigin({
      rootDir: fixtureDir,
      originRaw: "https://example.com/registry///",
      defaultOrigin: REGISTRY_ORIGIN,
      afterBuild: ({ outputDir }) => {
        writeFileSync(
          join(outputDir, "button.json"),
          `${JSON.stringify({ registryDependencies: [`${REGISTRY_ORIGIN}/r/ui/button.json`] })}\n`,
        );
      },
    });
    const item = JSON.parse(readFileSync(resolve(result.outputDir, "button.json"), "utf8")) as {
      registryDependencies: string[];
    };
    const dependencyUrl = new URL(item.registryDependencies[0] ?? "");

    expect(result.origin).toBe("https://example.com/registry");
    expect(dependencyUrl.pathname).toBe("/registry/r/ui/button.json");
    expect(dependencyUrl.search).toBe("");
    expect(dependencyUrl.hash).toBe("");
  });

  it("rejects an invalid origin before the registry build starts", () => {
    const beforeBuild = vi.fn();

    expect(() =>
      buildShadcnRegistryWithOrigin({
        rootDir: "/unused",
        originRaw: "https://example.com/registry?preview=1",
        defaultOrigin: REGISTRY_ORIGIN,
        beforeBuild,
      }),
    ).toThrow(/REGISTRY_ORIGIN/);
    expect(beforeBuild).not.toHaveBeenCalled();
  });
});

describe("resolveRegistryRoute", () => {
  const options = { origin: "https://example.com/registry///" };

  it.each([
    ["https://example.com/registry/r/ui/button.json", "/ui/button.json"],
    ["https://example.com/registry/r/keys/navigation.json", "/keys/navigation.json"],
    ["https://example.com/registry/r/ui/registry.json", "/ui/registry.json"],
  ])("resolves %s relative to the configured origin and base path", (url, route) => {
    expect(resolveRegistryRoute(url, options)).toBe(route);
  });

  it.each([
    "https://other.example.com/registry/r/ui/button.json",
    "https://example.com/r/ui/button.json",
    "https://example.com/registry-other/r/ui/button.json",
    "https://example.com/registry/r/ui/button.json?preview=1",
    "https://example.com/registry/r/ui/button.json#preview",
    "https://example.com/registry/r/ui/nested/button.json",
    "https://example.com/registry/ui/button.json",
  ])("rejects a same-suffix URL outside the exact configured boundary: %s", (url) => {
    expect(resolveRegistryRoute(url, options)).toBeNull();
  });
});
