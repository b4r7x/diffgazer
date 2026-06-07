import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliEntry = resolve(repoRoot, "cli/diffgazer/src/index.tsx");

function runDiffgazer(args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
}

describe("diffgazer CLI options", () => {
  test("prints help without starting servers", () => {
    const output = runDiffgazer(["--help"]);

    expect(output).toMatch(/Usage: diffgazer \[options\]/);
    expect(output).toMatch(/--tui\s+Start the beta terminal UI \(incomplete; not recommended\)/);
    expect(output).toMatch(/--theme <theme>\s+Start TUI with a specific theme \(only with --tui\)/);
  });

  test("prints a version without reading package.json at runtime", () => {
    // The published binary injects package.json's version at build time (tsup
    // `define`). Run from source via tsx the define is absent, so the CLI must
    // fall back to the documented dev placeholder instead of crashing on a
    // missing/renamed package.json.
    expect(runDiffgazer(["--version"]).trim()).toBe("0.0.0-dev");
  });

  test("exits with an error for invalid options", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", cliEntry, "--theme", "classic"],
      {
        cwd: repoRoot,
        encoding: "utf-8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--theme requires --tui\./);
  });
});
