import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { afterEach, beforeEach } from "node:test";

let root: string;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function runDgadd(args: string[]): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", resolve(repoRoot, "cli/add/src/index.ts"), "--silent", ...args],
    { cwd: repoRoot, encoding: "utf-8" },
  );
}

function runDgaddVisible(args: string[]): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", resolve(repoRoot, "cli/add/src/index.ts"), ...args],
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
  }, null, 2));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

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

test("list json hides internal items and omits bare aliases by default", () => {
  const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json"])) as Array<{ name: string }>;
  const names = items.map((item) => item.name);

  assert.ok(names.includes("ui/button"));
  assert.ok(!names.includes("button"));
  assert.ok(!names.includes("ui/theme"));
  assert.ok(!names.includes("theme"));
  assert.ok(!names.includes("ui/portal"));
  assert.ok(!names.includes("ui/dialog-shell"));
  assert.equal(names.length, new Set(names).size);
});

test("list json --all includes hidden internal items once", () => {
  const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json", "--all"])) as Array<{ name: string }>;
  const names = items.map((item) => item.name);

  assert.equal(names.filter((name) => name === "ui/portal").length, 1);
  assert.equal(names.filter((name) => name === "ui/dialog-shell").length, 1);
  assert.equal(names.length, new Set(names).size);
});

test("bare ui aliases still install", () => {
  runDgadd(["add", "button", "--cwd", root, "--yes", "--skip-install"]);

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

test("keys remove deletes transitive copied hook files owned by the key item", () => {
  runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);

  assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), true);
  assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), true);
  assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), true);
  assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), true);

  runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

  assert.equal(existsSync(join(root, "src/hooks/use-focus-trap.ts")), false);
  assert.equal(existsSync(join(root, "src/hooks/use-focus-restore.ts")), false);
  assert.equal(existsSync(join(root, "src/hooks/utils/focus-restore.ts")), false);
  assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), false);
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
  assert.equal(existsSync(join(root, "src/hooks/utils/navigation-items.ts")), false);
});

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

test("remove blocks copied keys hooks still required by retained copy-mode UI", () => {
  runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

  const output = runDgaddVisible(["remove", "keys/navigation", "--cwd", root, "--yes"]);

  assert.match(output, /Keeping keys\/navigation/);
  assert.match(output, /ui\/select/);
  assert.equal(existsSync(join(root, "src/hooks/use-navigation.ts")), true);
  assert.equal(existsSync(join(root, "src/hooks/internal/navigation-dispatch.ts")), true);

  const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
  assert.ok(updated.installedComponents?.["ui/select"]);
  assert.ok(updated.installedComponents?.["keys/navigation"]);
});

test("mixed remove updates manifest and output only for actually removed items", () => {
  runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

  const navigationHook = join(root, "src/hooks/use-navigation.ts");
  writeFileSync(navigationHook, `${readFileSync(navigationHook, "utf-8")}\n// user edit\n`);

  const output = runDgaddVisible(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"]);

  assert.match(output, /Removed \d+ file\(s\) \(ui\/select\)/);
  assert.doesNotMatch(output, /Removed \d+ file\(s\) \(ui\/select, keys\/navigation\)/);
  assert.equal(existsSync(join(root, "src/components/ui/select/select.tsx")), false);
  assert.equal(existsSync(navigationHook), true);

  const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
  assert.equal(updated.installedComponents?.["ui/select"], undefined);
  assert.ok(updated.installedComponents?.["keys/navigation"]);
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

test("keys package integration diff is up to date immediately after add", () => {
  runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

  const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
  assert.match(readFileSync(selectContentSource, "utf-8"), /from "@diffgazer\/keys"/);

  const output = runDgaddVisible(["diff", "ui/select", "--cwd", root]);
  assert.match(output, /All Diffgazer items are up to date with registry\./);
});

test("keys package integration diff reports modified installed files", () => {
  runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

  const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
  writeFileSync(selectContentSource, `${readFileSync(selectContentSource, "utf-8")}\n// user edit\n`);

  const output = runDgaddVisible(["diff", "ui/select", "--cwd", root]);
  assert.match(output, /Summary: \d+ changed/);
  assert.match(output, /user edit/);
});
