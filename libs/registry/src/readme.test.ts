import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as publicRegistryApi from "./index.js";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
) as { exports?: Record<string, unknown> };
const readme = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf8");

describe("registry README public API inventory", () => {
  it("lists only importable root APIs and exported package paths", () => {
    const documentedApis = Array.from(
      readme.matchAll(/^- \*\*`([A-Za-z][A-Za-z0-9]*)\([^`]*\)`\*\*/gm),
    ).flatMap((match) => (match[1] ? [match[1]] : []));
    const documentedPackagePaths = Array.from(
      readme.matchAll(/from "(@diffgazer\/registry(?:\/[^"\s]+)?)"/g),
    ).flatMap((match) => (match[1] ? [match[1]] : []));

    expect(documentedApis.length).toBeGreaterThan(0);
    expect(documentedApis.filter((name) => !(name in publicRegistryApi))).toEqual([]);
    expect(
      documentedPackagePaths.filter((packagePath) => {
        const subpath = packagePath.slice("@diffgazer/registry".length);
        const exportKey = subpath ? `.${subpath}` : ".";
        return packageJson.exports?.[exportKey] === undefined;
      }),
    ).toEqual([]);
  });
});
