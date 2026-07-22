import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { runCommand, type CommandResult } from "./support/run-command";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliEntry = resolve(repoRoot, "cli/diffgazer/src/index.tsx");

async function runDiffgazer(args: string[]): Promise<CommandResult> {
  return runCommand(process.execPath, ["--import", "tsx", cliEntry, ...args], { cwd: repoRoot });
}

describe("diffgazer CLI options", () => {
  test("prints help without starting servers", async () => {
    const { stdout } = await runDiffgazer(["--help"]);

    expect(stdout).toMatch(/Usage: diffgazer \[options\]/);
    expect(stdout).toMatch(/--tui\s+Start the terminal UI/);
    expect(stdout).toMatch(
      /--theme <theme>\s+Start TUI with a theme: auto, dark, light, high-contrast \(only with --tui\)/,
    );
  });

  test("prints a version without reading package.json at runtime", async () => {
    // The published binary injects package.json's version at build time (tsup
    // `define`). Run from source via tsx the define is absent, so the CLI must
    // fall back to the documented dev placeholder instead of crashing on a
    // missing/renamed package.json.
    const { stdout } = await runDiffgazer(["--version"]);
    expect(stdout.trim()).toBe("0.0.0-dev");
  });

  test("exits with an error for invalid options", async () => {
    const result = await runDiffgazer(["--theme", "classic"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--theme requires --tui\./);
  });
});
