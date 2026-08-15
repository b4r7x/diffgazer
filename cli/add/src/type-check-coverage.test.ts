import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(packageRoot, relativePath), "utf-8"));
}

describe("package type-check covers every TypeScript program", () => {
  test("root tool configs are all included in tsconfig.config.json", () => {
    const rootConfigs = readdirSync(packageRoot).filter((entry) => entry.endsWith(".config.ts"));
    const included = readJson("tsconfig.config.json").include;

    expect(rootConfigs.length).toBeGreaterThan(0);
    expect(included).toEqual(expect.arrayContaining(rootConfigs));
  });

  test("the type-check script runs every tsconfig project", () => {
    const scripts = readJson("package.json").scripts as Record<string, string>;

    for (const project of ["scripts/tsconfig.json", "tsconfig.config.json"]) {
      expect(scripts["type-check"]).toContain(`-p ${project}`);
    }
  });
});
