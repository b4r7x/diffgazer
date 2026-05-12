import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { afterEach, beforeEach, describe } from "node:test";

let root: string;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function runDgadd(args: string[], opts?: { silent?: boolean }): string {
  const silent = opts?.silent ?? true;
  return execFileSync(
    process.execPath,
    ["--import", "tsx", resolve(repoRoot, "cli/add/src/index.ts"), ...(silent ? ["--silent"] : []), ...args],
    { cwd: repoRoot, encoding: "utf-8" },
  );
}

function writeFixtureConfig(): void {
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  }));
  writeFileSync(join(root, "diffgazer.json"), JSON.stringify({
    aliases: {
      components: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    componentsFsPath: "src/components/ui",
    libFsPath: "src/lib",
    hooksFsPath: "src/hooks",
    tailwind: { css: "src/styles/styles.css" },
  }, null, 2));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("add command", () => {
  test("add records only files it wrote and remove keeps modified owned files", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = config.installedComponents["ui/button"].files;
    assert.ok(ownedFiles.length > 0);
    assert.ok(ownedFiles.every((file: { hash?: string }) => file.hash?.startsWith("sha256-")));

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    assert.equal(readFileSync(buttonIndex, "utf-8"), "// user edits\n");
    assert.equal(existsSync(buttonSource), true);
  });

  test("init uses a Vite-only custom alias when TypeScript paths are absent", () => {
    rmSync(join(root, "diffgazer.json"), { force: true });
    rmSync(join(root, "tsconfig.json"), { force: true });
    writeFileSync(join(root, "vite.config.ts"), [
      "import path from 'node:path';",
      "export default {",
      "  resolve: { alias: { '~': path.resolve(__dirname, './src') } },",
      "};",
      "",
    ].join("\n"));

    runDgadd(["init", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(config.aliases.components, "~/components/ui");
    assert.equal(config.aliases.utils, "~/lib/utils");
    assert.equal(config.aliases.lib, "~/lib");
    assert.equal(config.aliases.hooks, "~/hooks");
    assert.equal(config.componentsFsPath, "src/components/ui");
    assert.equal(config.libFsPath, "src/lib");
    assert.equal(config.hooksFsPath, "src/hooks");

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    assert.equal(existsSync(buttonSource), true);
    assert.match(readFileSync(buttonSource, "utf-8"), /from "~\/lib\/utils"/);
  });

  test("hidden keys utilities cannot be installed directly", () => {
    assert.throws(
      () => runDgadd(["add", "keys/focusable", "--cwd", root, "--yes", "--skip-install"]),
      /not found/,
    );
  });

  test("bare names without namespace prefix are rejected", () => {
    assert.throws(
      () => runDgadd(["add", "button", "--cwd", root, "--yes", "--skip-install"]),
      /not found|Invalid item name|Use a namespaced name/,
    );
    assert.equal(existsSync(join(root, "src/components/ui/button/button.tsx")), false);
  });

  test("add does not adopt skipped pre-existing files into the ownership manifest", () => {
    const preExisting = [
      "src/components/ui/button/index.ts",
      "src/components/ui/button/button.tsx",
      "src/components/ui/spinner/index.ts",
      "src/components/ui/spinner/spinner.tsx",
      "src/components/ui/spinner/use-spinner-animation.ts",
      "src/components/ui/spinner/spinner-snake-grid.tsx",
    ];
    for (const relativePath of preExisting) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "// user file\n");
    }

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(config.installedComponents, undefined);
  });

  test("keys add records ownership and remove deletes matching owned files without force", () => {
    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = config.installedComponents["keys/navigation"].files;
    assert.ok(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts"));
    assert.ok(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/internal/navigation-dispatch.ts"));
    assert.ok(ownedFiles.every((file: { path: string }) => !file.path.includes("\\")));
    assert.doesNotMatch(
      readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8"),
      /from "\.\/internal\/navigation-dispatch\.js"/,
    );

    runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"]);

    assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(updated.installedComponents?.["keys/navigation"], undefined);
  });

  test("keys add preserves explicit ownership for hooks that overlap transitive files", () => {
    runDgadd(["add", "keys/focus-trap", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.ok(config.installedComponents?.["keys/focus-trap"]);
    assert.ok(config.installedComponents?.["keys/focus-restore"]);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(updated.installedComponents?.["keys/focus-trap"], undefined);
    assert.ok(updated.installedComponents?.["keys/focus-restore"]);
    assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focusable.ts")), false);
  });

  test("sequential keys add adopts shared trusted files into the second item's manifest", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.ok(config.installedComponents?.["keys/focus-trap"]);
    assert.ok(config.installedComponents?.["keys/focus-restore"]);

    const restoreFiles: Array<{ path: string }> = config.installedComponents["keys/focus-restore"].files ?? [];
    assert.ok(
      restoreFiles.some((file) => file.path === "src/hooks/use-focus-restore.ts"),
      "second add should adopt shared use-focus-restore.ts via manifest",
    );
    assert.ok(
      restoreFiles.some((file) => file.path === "src/hooks/utils/focus-restore.ts"),
      "second add should adopt shared utils/focus-restore.ts via manifest",
    );

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), true);

    const finalConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.ok(finalConfig.installedComponents?.["keys/focus-restore"]);
  });

  test("keys add does not adopt arbitrary pre-existing files into the new item's manifest", () => {
    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    mkdirSync(dirname(navigationHook), { recursive: true });
    writeFileSync(navigationHook, "// user-authored impostor\n");

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const navigationRecord = config.installedComponents?.["keys/navigation"];
    const navigationFiles: Array<{ path: string }> = navigationRecord?.files ?? [];
    assert.ok(
      !navigationFiles.some((file) => file.path === "src/hooks/use-navigation.ts"),
      "pre-existing user file with mismatched content must not be adopted",
    );

    assert.equal(readFileSync(navigationHook, "utf-8"), "// user-authored impostor\n");
  });

  test("add appends required component CSS to the configured Tailwind entry", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(
      join(root, "src/styles/styles.css"),
      [
        "/* Canonical style seed. Package builds and dgadd init append registry component CSS to this entry. */",
        '@import "./theme.css";',
        "",
      ].join("\n"),
    );

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const styles = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    assert.match(styles, /dialog::backdrop/);
    assert.equal(existsSync(join(root, "src/components/ui/shared/dialog.css")), false);
  });

  test("invalid fs path config fails before writing outside the project", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "../outside";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    assert.throws(
      () => runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]),
      /escapes|Project paths/,
    );
    assert.equal(existsSync(resolve(root, "..", "outside", "use-navigation.ts")), false);
  });

  test("windows-style config paths are normalized in ownership records", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "src\\hooks";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = updated.installedComponents["keys/navigation"].files;
    assert.ok(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts"));
    assert.ok(ownedFiles.every((file: { path: string }) => !file.path.includes("\\")));
  });
});

describe("remove command", () => {
  test("remove --force deletes modified owned files and clears ownership", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    writeFileSync(buttonIndex, "// user edits\n");

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes", "--force"], { silent: false });

    assert.match(output, /Removed \d+ file\(s\) \(ui\/button\)/);
    assert.equal(existsSync(buttonIndex), false);
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(config.installedComponents?.["ui/button"], undefined);
  });

  test("remove --dry-run previews owned files without changing files or manifest", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--dry-run", "--yes"], { silent: false });

    assert.match(output, /Files to remove:/);
    assert.match(output, /src\/components\/ui\/button\/index\.ts/);
    assert.match(output, /\(dry run - no changes made\)/);
    assert.equal(existsSync(buttonIndex), true);

    const after = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.deepEqual(after.installedComponents, before.installedComponents);
  });

  test("bare names are rejected for remove command too", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    assert.throws(
      () => runDgadd(["remove", "button", "--cwd", root, "--yes"]),
      /not found|Invalid item name|Use a namespaced name/,
    );
    assert.equal(existsSync(join(root, "src/components/ui/button/button.tsx")), true);
  });

  test("remove does not delete matching files without ownership metadata", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    delete config.installedComponents;
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    assert.equal(existsSync(buttonIndex), true);
  });

  test("keys remove deletes transitive copied hook files owned by the key item", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focusable.ts")), true);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/utils/focusable.ts")), false);
  });

  test("remove blocks copied keys hooks still required by retained copy-mode UI", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"], { silent: false });

    assert.match(output, /Keeping keys\/navigation/);
    assert.match(output, /ui\/select/);
    assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.ok(updated.installedComponents?.["ui/select"]);
    assert.ok(updated.installedComponents?.["keys/navigation"]);
  });

  test("mixed remove deletes copied keys hooks when their copy-mode UI dependent is removed too", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"]);

    assert.equal(existsSync(join(root, "src/components/ui/select/select.tsx")), false);
    assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), false);
    assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(updated.installedComponents?.["ui/select"], undefined);
    assert.equal(updated.installedComponents?.["keys/navigation"], undefined);
  });

  test("mixed remove updates manifest and output only for actually removed items", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    writeFileSync(navigationHook, `${readFileSync(navigationHook, "utf-8")}\n// user edit\n`);

    const output = runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"], { silent: false });

    assert.match(output, /Removed \d+ file\(s\) \(ui\/select\)/);
    assert.doesNotMatch(output, /Removed \d+ file\(s\) \(ui\/select, keys\/navigation\)/);
    assert.equal(existsSync(join(root, "src/components/ui/select/select.tsx")), false);
    assert.equal(existsSync(navigationHook), true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(updated.installedComponents?.["ui/select"], undefined);
    assert.ok(updated.installedComponents?.["keys/navigation"]);
  });
});

describe("list command", () => {
  test("list json hides internal items and omits bare aliases by default", () => {
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json"])) as Array<{ name: string }>;
    const names = items.map((item) => item.name);

    assert.ok(names.includes("ui/button"));
    assert.ok(!names.includes("button"));
    assert.ok(!names.includes("ui/theme"));
    assert.ok(!names.includes("theme"));
    assert.ok(!names.includes("ui/portal"));
    assert.ok(!names.includes("ui/dialog-shell"));
    assert.ok(!names.includes("keys/focusable"));
    assert.equal(names.length, new Set(names).size);
  });

  test("list json --all includes hidden internal items once", () => {
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json", "--all"])) as Array<{ name: string }>;
    const names = items.map((item) => item.name);

    assert.equal(names.filter((name) => name === "ui/portal").length, 1);
    assert.equal(names.filter((name) => name === "ui/dialog-shell").length, 1);
    assert.equal(names.filter((name) => name === "keys/focusable").length, 1);
    assert.equal(names.length, new Set(names).size);
  });
});

describe("integration modes", () => {
  test("copy integration installs keys transitive files with bundler-safe relative imports", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), true);
    assert.doesNotMatch(
      readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8"),
      /from "\.\/internal\/navigation-dispatch\.js"/,
    );
    assert.match(
      readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8"),
      /from "\.\/internal\/navigation-dispatch"/,
    );
    assert.match(
      readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8"),
      /from "\.\/utils\/navigation-items"/,
    );
  });

  test("copy integration rewrites package-root keys imports to copied sources", () => {
    runDgadd(["add", "ui/accordion", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focusable.ts")), true);

    const content = readFileSync(join(root, "src/components/ui/accordion/accordion.tsx"), "utf-8");
    assert.doesNotMatch(content, /@diffgazer\/keys/);
    assert.match(content, /@\/hooks\/utils\/navigation-items/);
  });

  test("copy integration installs focusable utilities for popover-backed UI", () => {
    runDgadd(["add", "ui/popover", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/utils/focusable.ts")), true);

    const content = readFileSync(join(root, "src/components/ui/popover/use-auto-focus.ts"), "utf-8");
    assert.doesNotMatch(content, /@diffgazer\/keys/);
    assert.match(content, /@\/hooks\/utils\/focusable/);
  });

  test("copy integration installs focus restore for dialog-backed UI", () => {
    runDgadd(["add", "ui/command-palette", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), true);

    const content = readFileSync(
      join(root, "src/components/ui/command-palette/command-palette-content.tsx"),
      "utf-8",
    );
    assert.doesNotMatch(content, /@diffgazer\/keys/);
    assert.match(content, /@\/hooks\/use-focus-restore/);
  });

  test("copy integration installs navigation for radio-backed UI", () => {
    runDgadd(["add", "ui/radio", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), true);
    assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), true);

    const content = readFileSync(join(root, "src/components/ui/radio/radio-group.tsx"), "utf-8");
    assert.doesNotMatch(content, /@diffgazer\/keys/);
    assert.match(content, /@\/hooks\/use-navigation/);
  });

  test("none integration is rejected when selected components require keys hooks", () => {
    assert.throws(
      () => runDgadd(["add", "ui/select", "--integration", "none", "--cwd", root, "--yes", "--skip-install"]),
      /require keyboard hooks|Components reference keyboard hooks/,
    );
    assert.equal(existsSync(join(root, "src/components/ui/select/select.tsx")), false);
    assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), false);
  });

  test("none integration installs components that do not require keys hooks", () => {
    runDgadd(["add", "ui/button", "--integration", "none", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    assert.equal(existsSync(join(root, "src/components/ui/button/button.tsx")), true);
    assert.equal(config.installedComponents["ui/button"].integrationMode, "none");
  });

  test("keys package integration diff is up to date immediately after add", () => {
    runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

    const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
    assert.match(readFileSync(selectContentSource, "utf-8"), /from "@diffgazer\/keys"/);

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    assert.match(output, /All Diffgazer items are up to date with registry\./);
  });

  test("keys package integration diff reports modified installed files", () => {
    runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

    const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
    writeFileSync(selectContentSource, `${readFileSync(selectContentSource, "utf-8")}\n// user edit\n`);

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    assert.match(output, /Summary: \d+ changed/);
    assert.match(output, /user edit/);
  });
});
