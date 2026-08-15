import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { aliasPathSchema, loadJsonConfig, validateImportAlias } from "./config.js";
import { createRequireConfig } from "./require-config.js";

describe("validateImportAlias", () => {
  it.each([
    "@/components/ui",
    "@/lib/utils",
    "@/hooks",
    "@app/components",
    "~/hooks",
    "#/lib/utils",
    "@scope/pkg/lib/",
  ])("accepts safe alias %s", (alias) => {
    expect(validateImportAlias(alias)).toBeUndefined();
    expect(aliasPathSchema.safeParse(alias).success).toBe(true);
  });

  it.each(["./hooks", "../hooks", "./lib/utils"])("rejects relative alias %s", (alias) => {
    expect(validateImportAlias(alias)).toMatch(/Relative paths belong in \*FsPath fields/);
    expect(aliasPathSchema.safeParse(alias).success).toBe(false);
  });

  it.each([
    '@/lib/utils";import("x");//',
    "@/hooks\n/evil",
    "@/lib/utils`",
    "@/lib\\utils",
    "@/hooks/../evil",
    "@/lib/utils\x00",
  ])("rejects injection or traversal alias %s", (alias) => {
    expect(validateImportAlias(alias)).toBeDefined();
    expect(aliasPathSchema.safeParse(alias).success).toBe(false);
  });
});

describe("loadJsonConfig read failures", () => {
  const schema = z.object({ name: z.string() });
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "dgadd-config-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("reports an absent config as not_found", () => {
    expect(loadJsonConfig("diffgazer.json", schema, cwd)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("reports a present but unreadable config as read_error with the path and cause", () => {
    mkdirSync(join(cwd, "diffgazer.json"));

    const result = loadJsonConfig("diffgazer.json", schema, cwd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("read_error");
    expect(result.message).toContain(join(cwd, "diffgazer.json"));
  });

  it("does not tell the user to run init when the config exists but cannot be read", () => {
    mkdirSync(join(cwd, "diffgazer.json"));
    const requireConfig = createRequireConfig({
      configFileName: "diffgazer.json",
      initCommand: "dgadd init",
      loadResolved: (dir) => loadJsonConfig("diffgazer.json", schema, dir),
    });

    expect(() => requireConfig(cwd)).toThrow(/Could not read/);
    expect(() => requireConfig(cwd)).not.toThrow(/Run `dgadd init` first/);
  });

  it("still reports a missing config with the init remediation", () => {
    const requireConfig = createRequireConfig({
      configFileName: "diffgazer.json",
      initCommand: "dgadd init",
      loadResolved: (dir) => loadJsonConfig("diffgazer.json", schema, dir),
    });

    expect(() => requireConfig(cwd)).toThrow(/No diffgazer.json found/);
  });

  it("still reports malformed JSON as a parse error", () => {
    writeFileSync(join(cwd, "diffgazer.json"), "{");

    const result = loadJsonConfig("diffgazer.json", schema, cwd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("parse_error");
  });
});
