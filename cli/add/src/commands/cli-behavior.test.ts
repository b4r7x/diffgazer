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
  const ownedFiles = config.installedComponents.button.files;
  assert.ok(ownedFiles.length > 0);
  assert.ok(ownedFiles.every((file: { hash?: string }) => file.hash?.startsWith("sha256-")));

  const buttonIndex = join(root, "src/components/ui/button/index.ts");
  const buttonSource = join(root, "src/components/ui/button/button.tsx");
  writeFileSync(buttonIndex, "// user edits\n");

  runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

  assert.equal(readFileSync(buttonIndex, "utf-8"), "// user edits\n");
  assert.equal(existsSync(buttonSource), true);
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
