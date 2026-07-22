import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { repoRoot, runDgadd, writeFixtureConfig } from "./test-helpers.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("init command", () => {
  test("init uses a Vite-only custom alias when TypeScript paths are absent", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    rmSync(join(root, "tsconfig.json"), { force: true });
    writeFileSync(
      join(root, "vite.config.ts"),
      [
        "import path from 'node:path';",
        "export default {",
        "  resolve: { alias: { '~': path.resolve(__dirname, './src') } },",
        "};",
        "",
      ].join("\n"),
    );

    runDgadd(["init", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.aliases.components).toBe("~/components/ui");
    expect(config.aliases.utils).toBe("~/lib/utils");
    expect(config.aliases.lib).toBe("~/lib");
    expect(config.aliases.hooks).toBe("~/hooks");
    expect(config.componentsFsPath).toBe("src/components/ui");
    expect(config.libFsPath).toBe("src/lib");
    expect(config.hooksFsPath).toBe("src/hooks");

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    expect(existsSync(buttonSource)).toBe(true);
    expect(readFileSync(buttonSource, "utf-8")).toMatch(/from "~\/lib\/utils"/);
  });

  test("init --skip-install lists required dependencies without mutating package.json", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    const packageJson = `${JSON.stringify(
      {
        type: "module",
        dependencies: { react: "^19.2.0", tailwindcss: "^4.0.0" },
      },
      null,
      2,
    )}\n`;
    writeFileSync(join(root, "package.json"), packageJson);

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve(repoRoot, "cli/add/src/index.ts"),
        "init",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
      ],
      {
        cwd: repoRoot,
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(readFileSync(join(root, "package.json"), "utf-8")).toBe(packageJson);
    const utils = readFileSync(join(root, "src/lib/utils.ts"), "utf-8");
    expect(utils).toContain('from "clsx"');
    expect(utils).toContain('from "tailwind-merge"');
    expect(result.stdout).toContain(
      [
        "  Dependency installation skipped",
        "  Skipped via --skip-install. Install these packages manually when ready:",
        "    class-variance-authority",
        "    clsx",
        "    tailwind-merge",
      ].join("\n"),
    );
  });
  test("init --silent --yes fails and rolls back when dependency install fails", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    // Empty PATH so no package manager resolves and the default install fails.
    expect(() =>
      runDgadd(["init", "--cwd", root, "--yes"], { env: { ...process.env, PATH: "" } }),
    ).toThrow();
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
    expect(existsSync(join(root, "src/lib/utils.ts"))).toBe(false);
  });
});
