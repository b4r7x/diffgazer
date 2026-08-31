import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { PACKAGE_MANAGER_LOCKFILES } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readFixtureConfig, runDgadd, spawnDgadd, writeFixtureConfig } from "./test-helpers.js";

let root: string;

function snapshotFixtureTree(directory: string): Map<string, Buffer | null> {
  const snapshot = new Map<string, Buffer | null>();

  const visit = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      const fixturePath = relative(directory, absolutePath);
      if (entry.isDirectory()) {
        snapshot.set(`${fixturePath}/`, null);
        visit(absolutePath);
      } else {
        snapshot.set(fixturePath, readFileSync(absolutePath));
      }
    }
  };

  visit(directory);
  return snapshot;
}

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

    const config = readFixtureConfig(root);
    expect(config.aliases?.components).toBe("~/components/ui");
    expect(config.aliases?.utils).toBe("~/lib/utils");
    expect(config.aliases?.lib).toBe("~/lib");
    expect(config.aliases?.hooks).toBe("~/hooks");
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

    const result = spawnDgadd(["init", "--cwd", root, "--yes", "--skip-install"]);

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
    const packageJsonPath = join(root, "package.json");
    const packageJson = `${JSON.stringify(
      {
        type: "module",
        packageManager: "pnpm@10.0.0",
        devDependencies: { tailwindcss: "^4.0.0" },
      },
      null,
      2,
    )}\n`;
    writeFileSync(packageJsonPath, packageJson);
    for (const [index, lockfile] of PACKAGE_MANAGER_LOCKFILES.entries()) {
      if (index % 2 === 0) {
        writeFileSync(join(root, lockfile), `original ${lockfile}\n`);
      }
    }

    const before = snapshotFixtureTree(root);
    const fakeBin = mkdtempSync(join(tmpdir(), "dgadd-fake-pnpm-"));
    const installMarker = join(root, ".fake-pm-ran");
    const fakePnpm = join(fakeBin, "pnpm");
    writeFileSync(
      fakePnpm,
      [
        "#!/bin/sh",
        `printf '%s\\n' '{"dependencies":{"transaction-mutated":"1.0.0"}}' > '${packageJsonPath}'`,
        ...PACKAGE_MANAGER_LOCKFILES.map(
          (lockfile) => `printf '%s\\n' 'mutated ${lockfile}' > '${join(root, lockfile)}'`,
        ),
        `printf '%s\\n' 'ran' > '${installMarker}'`,
        "echo 'fake pnpm install failed' >&2",
        "exit 1",
      ].join("\n"),
    );
    chmodSync(fakePnpm, 0o755);

    try {
      expect(() =>
        runDgadd(["init", "--cwd", root, "--yes"], {
          env: { PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
        }),
      ).toThrow(/pnpm install failed/);

      expect(existsSync(installMarker)).toBe(true);
      const after = snapshotFixtureTree(root);
      const expected = new Map(before);
      expected.set(".fake-pm-ran", Buffer.from("ran\n"));
      expect(after, "post-rollback tree must equal pre-run snapshot plus install marker").toEqual(
        expected,
      );
    } finally {
      rmSync(fakeBin, { recursive: true, force: true });
    }
  });

  test("init --dry-run leaves the complete fixture tree byte-identical", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    mkdirSync(join(root, "src/components/existing"), { recursive: true });
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/components/existing/index.ts"), "export {};\n");
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const before = snapshotFixtureTree(root);

    const result = spawnDgadd(["init", "--cwd", root, "--dry-run"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Source dir: src/");
    expect(result.stdout).toContain("Path alias: @/*");
    expect(result.stdout).toContain("(dry run - no changes made)");
    expect(snapshotFixtureTree(root)).toEqual(before);
  });

  test("init --force rejects a changed component root before writing", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const before = snapshotFixtureTree(root);

    expect(() =>
      runDgadd([
        "init",
        "--cwd",
        root,
        "--force",
        "--yes",
        "--skip-install",
        "--components-dir",
        "src/components/next",
      ]),
    ).toThrow(/Cannot change the install topology.*--reset-manifest/s);
    expect(snapshotFixtureTree(root)).toEqual(before);
  });

  test("init --force preserves installed ownership when topology is unchanged", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    runDgadd(["init", "--cwd", root, "--force", "--yes", "--skip-install"]);

    const config = readFixtureConfig(root);
    expect(config.installedItems?.["ui/button"]).toBeDefined();
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
  });

  test("init --force preserves ledger when schema-invalid aliases leave topology unchanged", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const config = readFixtureConfig(root);
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify({ ...config, aliases: { components: 42 } }, null, 2)}\n`,
    );

    runDgadd(["init", "--cwd", root, "--force", "--yes", "--skip-install"]);

    const rewritten = readFixtureConfig(root);
    expect(rewritten.installedItems?.["ui/button"]).toBeDefined();
    expect(rewritten.aliases?.components).toBe("@/components/ui");
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
  });

  test("init --force rejects changed topology when schema-invalid aliases are present", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const config = readFixtureConfig(root);
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify({ ...config, aliases: { components: 42 } }, null, 2)}\n`,
    );
    const before = snapshotFixtureTree(root);

    expect(() =>
      runDgadd([
        "init",
        "--cwd",
        root,
        "--force",
        "--yes",
        "--skip-install",
        "--components-dir",
        "src/components/next",
      ]),
    ).toThrow(/Cannot change the install topology.*--reset-manifest/s);
    expect(snapshotFixtureTree(root)).toEqual(before);
  });

  test("init --force rejects a changed detected source alias before writing", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "~/*": ["./src/*"] },
        },
      }),
    );
    const before = snapshotFixtureTree(root);

    expect(() => runDgadd(["init", "--cwd", root, "--force", "--yes", "--skip-install"])).toThrow(
      /Cannot change the install topology.*--reset-manifest/s,
    );
    expect(snapshotFixtureTree(root)).toEqual(before);
  });

  test("init --allow-missing-alias requires explicit alias and source dir", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    rmSync(join(root, "tsconfig.json"), { force: true });
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "~/*": ["./client/*"] },
        },
      }),
    );

    expect(() =>
      runDgadd(["init", "--cwd", root, "--yes", "--skip-install", "--allow-missing-alias"]),
    ).toThrow(/--import-alias-prefix and --source-dir/);

    runDgadd([
      "init",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
      "--allow-missing-alias",
      "--import-alias-prefix",
      "~",
      "--source-dir",
      "client",
    ]);

    const config = readFixtureConfig(root);
    expect(config.aliases?.components).toBe("~/components/ui");
    expect(config.componentsFsPath).toBe("client/components/ui");
  });

  test("init honours a custom --components-dir in the config, aliases, and copied files", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });

    runDgadd([
      "init",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
      "--components-dir",
      "src/custom/ui",
    ]);

    const config = readFixtureConfig(root);
    expect(config.componentsFsPath).toBe("src/custom/ui");
    expect(config.aliases?.components).toBe("@/custom/ui");
    expect(existsSync(join(root, "src/custom/ui"))).toBe(true);

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    expect(existsSync(join(root, "src/custom/ui/button/button.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
  });

  test("init keeps an explicit --components-dir when the source dir is not src", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    rmSync(join(root, "tsconfig.json"), { force: true });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }),
    );

    runDgadd([
      "init",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
      "--components-dir",
      "src/components/ui",
    ]);

    const config = readFixtureConfig(root);
    expect(config.componentsFsPath).toBe("src/components/ui");
    expect(existsSync(join(root, "src/components/ui"))).toBe(true);
    expect(existsSync(join(root, "components/ui"))).toBe(false);
  });

  test("init without --components-dir derives the default from the detected source dir", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    rmSync(join(root, "tsconfig.json"), { force: true });
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }),
    );

    runDgadd(["init", "--cwd", root, "--yes", "--skip-install"]);

    expect(readFixtureConfig(root).componentsFsPath).toBe("components/ui");
  });

  test("rejects a component directory outside the detected source alias root", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });

    expect(() =>
      runDgadd(["init", "--cwd", root, "--yes", "--skip-install", "--components-dir", "ui"]),
    ).toThrow(/must be inside detected source directory "src\/".*alias "@\/\*"/s);

    expect(existsSync(join(root, "ui"))).toBe(false);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("rejects relative traversal that escapes the detected source root", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    const before = snapshotFixtureTree(root);

    expect(() =>
      runDgadd(["init", "--cwd", root, "--yes", "--skip-install", "--components-dir", "src/../ui"]),
    ).toThrow(/must be inside detected source directory "src\/".*alias "@\/\*"/s);

    expect(snapshotFixtureTree(root)).toEqual(before);
    expect(existsSync(join(root, "ui"))).toBe(false);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("rejects an absolute components directory outside the project", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    const outside = mkdtempSync(join(tmpdir(), "dgadd-outside-components-"));
    const before = snapshotFixtureTree(root);
    const outsideBefore = snapshotFixtureTree(outside);

    expect(() =>
      runDgadd([
        "init",
        "--cwd",
        root,
        "--yes",
        "--skip-install",
        "--components-dir",
        join(outside, "components"),
      ]),
    ).toThrow(/Project paths must be relative/);

    expect(snapshotFixtureTree(root)).toEqual(before);
    expect(snapshotFixtureTree(outside)).toEqual(outsideBefore);
    rmSync(outside, { recursive: true, force: true });
  });

  test("rejects an in-source symlink that escapes the detected source root", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    const outside = mkdtempSync(join(tmpdir(), "dgadd-outside-symlink-"));
    writeFileSync(join(outside, "marker.txt"), "untouched\n");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/marker.ts"), "export {};\n");
    symlinkSync(outside, join(root, "src/escaped"));
    const projectMarker = readFileSync(join(root, "src/marker.ts"), "utf-8");
    const packageJson = readFileSync(join(root, "package.json"), "utf-8");
    const outsideMarker = readFileSync(join(outside, "marker.txt"), "utf-8");

    expect(
      () =>
        runDgadd([
          "init",
          "--cwd",
          root,
          "--yes",
          "--skip-install",
          "--components-dir",
          "src/escaped/components/ui",
        ]),
      // A symlink escape is reported as a traversal, not as a "put it under
      // src/" usage hint whose suggested path would escape the same way.
    ).toThrow(/escapes .* through a symlink or realpath/s);

    expect(readFileSync(join(root, "src/marker.ts"), "utf-8")).toBe(projectMarker);
    expect(readFileSync(join(root, "package.json"), "utf-8")).toBe(packageJson);
    expect(readFileSync(join(outside, "marker.txt"), "utf-8")).toBe(outsideMarker);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
    rmSync(outside, { recursive: true, force: true });
  });
});
