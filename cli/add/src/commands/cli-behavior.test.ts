import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

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
    expect(ownedFiles.length).toBeGreaterThan(0);
    expect(ownedFiles.every((file: { hash?: string }) => file.hash?.startsWith("sha256-"))).toBe(true);

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    expect(readFileSync(buttonIndex, "utf-8")).toBe("// user edits\n");
    expect(existsSync(buttonSource)).toBe(true);
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

  test("hidden keys utilities cannot be installed directly", () => {
    expect(
      () => runDgadd(["add", "keys/focusable", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/not found/);
  });

  test("bare names without namespace prefix are rejected", () => {
    expect(
      () => runDgadd(["add", "button", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/not found|Invalid item name|Use a namespaced name/);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
  });

  test("add does not adopt skipped pre-existing files into the ownership manifest", () => {
    const preExisting = [
      "src/components/ui/button/index.ts",
      "src/components/ui/button/button.tsx",
      "src/components/ui/spinner/index.ts",
      "src/components/ui/spinner/spinner.tsx",
      "src/components/ui/spinner/use-spinner-animation.ts",
      "src/components/ui/spinner/spinner-snake-grid.tsx",
      "src/lib/utils.ts",
    ];
    for (const relativePath of preExisting) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "// user file\n");
    }

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents).toBeUndefined();
  });

  test("keys add records ownership and remove deletes matching owned files without force", () => {
    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = config.installedComponents["keys/navigation"].files;
    expect(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts")).toBe(true);
    expect(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/utils/navigation-dispatch.ts")).toBe(true);
    expect(ownedFiles.every((file: { path: string }) => !file.path.includes("\\"))).toBe(true);
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).not.toMatch(
      /from "\.\.\/core\/navigation-dispatch\.js"/,
    );

    runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/navigation"]).toBeUndefined();
  });

  test("keys add preserves explicit ownership for hooks that overlap transitive files", () => {
    runDgadd(["add", "keys/focus-trap", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/focus-trap"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/focus-restore"]).toBeTruthy();
    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);
  });

  test("sequential keys add adopts shared trusted files into the second item's manifest", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(config.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    const restoreFiles: Array<{ path: string }> = config.installedComponents["keys/focus-restore"].files ?? [];
    expect(
      restoreFiles.some((file) => file.path === "src/hooks/use-focus-restore.ts"),
      "second add should adopt shared use-focus-restore.ts via manifest",
    ).toBe(true);
    expect(
      restoreFiles.some((file) => file.path === "src/hooks/utils/focus-restore.ts"),
      "second add should adopt shared utils/focus-restore.ts via manifest",
    ).toBe(true);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);

    const finalConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(finalConfig.installedComponents?.["keys/focus-restore"]).toBeTruthy();
  });

  test("keys add does not adopt arbitrary pre-existing files into the new item's manifest", () => {
    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    mkdirSync(dirname(navigationHook), { recursive: true });
    writeFileSync(navigationHook, "// user-authored impostor\n");

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const navigationRecord = config.installedComponents?.["keys/navigation"];
    const navigationFiles: Array<{ path: string }> = navigationRecord?.files ?? [];
    expect(
      navigationFiles.some((file) => file.path === "src/hooks/use-navigation.ts"),
      "pre-existing user file with mismatched content must not be adopted",
    ).toBe(false);

    expect(readFileSync(navigationHook, "utf-8")).toBe("// user-authored impostor\n");
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
    expect(styles).toMatch(/dialog::backdrop/);
    expect(existsSync(join(root, "src/components/ui/shared/dialog.css"))).toBe(false);
  });

  test("repeated add does not duplicate component CSS chunks even after whitespace edits", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(
      join(root, "src/styles/styles.css"),
      ['@import "./theme.css";', ""].join("\n"),
    );

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);
    const afterFirst = readFileSync(join(root, "src/styles/styles.css"), "utf-8");

    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    const startCountFirst = (afterFirst.match(markerPattern) ?? []).length;
    expect(startCountFirst, "expected sentinel markers after first add").toBeGreaterThan(0);

    const perturbed = afterFirst
      .replace(/\n\n/g, "\n\n\n")
      .replace(/(dgadd:css [a-f0-9]{16}(?: \S+)? \*\/)/, "$1\n/* user comment */");
    writeFileSync(join(root, "src/styles/styles.css"), perturbed);

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);
    const afterSecond = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    const startCountSecond = (afterSecond.match(markerPattern) ?? []).length;

    expect(
      startCountSecond,
      "re-running add must not append duplicate chunks under whitespace/comment edits",
    ).toBe(startCountFirst);
    const sentinelEnds = (afterSecond.match(/\/\* dgadd:css-end [a-f0-9]{16}(?: \S+)? \*\//g) ?? []).length;
    expect(sentinelEnds, "every chunk is bounded by matching markers").toBe(startCountSecond);
  });

  test("invalid fs path config fails before writing outside the project", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "../outside";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    expect(
      () => runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/escapes|Project paths/);
    expect(existsSync(resolve(root, "..", "outside", "use-navigation.ts"))).toBe(false);
  });

  test("windows-style config paths are normalized in ownership records", () => {
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    config.hooksFsPath = "src\\hooks";
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"]);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const ownedFiles = updated.installedComponents["keys/navigation"].files;
    expect(ownedFiles.some((file: { path: string }) => file.path === "src/hooks/use-navigation.ts")).toBe(true);
    expect(ownedFiles.every((file: { path: string }) => !file.path.includes("\\"))).toBe(true);
  });
});

describe("remove command", () => {
  test("remove --force deletes modified owned files and clears ownership", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    writeFileSync(buttonIndex, "// user edits\n");

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes", "--force"], { silent: false });

    expect(output).toMatch(/Removed \d+ file\(s\) \([^)]*ui\/button[^)]*\)/);
    expect(existsSync(buttonIndex)).toBe(false);
    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(config.installedComponents?.["ui/button"]).toBeUndefined();
  });

  test("remove --dry-run previews owned files without changing files or manifest", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--dry-run", "--yes"], { silent: false });

    expect(output).toMatch(/Files to remove:/);
    expect(output).toMatch(/src\/components\/ui\/button\/index\.ts/);
    expect(output).toMatch(/\(dry run - no changes made\)/);
    expect(existsSync(buttonIndex)).toBe(true);

    const after = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(after.installedComponents).toEqual(before.installedComponents);
  });

  test("bare names are rejected for remove command too", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    expect(
      () => runDgadd(["remove", "button", "--cwd", root, "--yes"]),
    ).toThrow(/not found|Invalid item name|Use a namespaced name/);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
  });

  test("remove does not delete matching files without ownership metadata", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    const buttonIndex = join(root, "src/components/ui/button/index.ts");

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    delete config.installedComponents;
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));

    runDgadd(["remove", "ui/button", "--cwd", root, "--yes"]);

    expect(existsSync(buttonIndex)).toBe(true);
  });

  test("keys remove deletes transitive copied hook files owned by the key item", () => {
    runDgadd(["add", "keys/focus-trap", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);
  });

  test("remove blocks copied keys hooks still required by retained copy-mode UI", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["remove", "keys/navigation", "--cwd", root, "--yes"], { silent: false });

    expect(output).toMatch(/Keeping keys\/navigation/);
    expect(output).toMatch(/ui\/select/);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeTruthy();
    expect(updated.installedComponents?.["keys/navigation"]).toBeTruthy();
  });

  test("mixed remove deletes copied keys hooks when their copy-mode UI dependent is removed too", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/navigation"]).toBeUndefined();
  });

  test("mixed remove updates manifest and output only for actually removed items", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    const navigationHook = join(root, "src/hooks/use-navigation.ts");
    writeFileSync(navigationHook, `${readFileSync(navigationHook, "utf-8")}\n// user edit\n`);

    const output = runDgadd(["remove", "ui/select", "keys/navigation", "--cwd", root, "--yes"], { silent: false });

    expect(output).toMatch(/Removed \d+ file\(s\) \([^)]*ui\/select[^)]*\)/);
    expect(output).not.toMatch(/Removed \d+ file\(s\) \([^)]*keys\/navigation[^)]*\)/);
    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(navigationHook)).toBe(true);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["ui/select"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/navigation"]).toBeTruthy();
  });

  test("remove of a transitive blocks when a retained item still depends on it", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const buttonSource = join(root, "src/components/ui/button/button.tsx");
    expect(existsSync(buttonSource)).toBe(true);

    const output = runDgadd(["remove", "ui/button", "--cwd", root, "--yes"], { silent: false });

    expect(output).toMatch(/Keeping ui\/button; still required by: ui\/dialog/);
    expect(existsSync(buttonSource)).toBe(true);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(manifest.installedComponents?.["ui/dialog"]).toBeTruthy();
  });

  test("remove of the explicit item cascades orphan transitives", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const beforeManifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(beforeManifest.installedComponents?.["ui/portal"]).toBeTruthy();
    expect(beforeManifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(beforeManifest.installedComponents?.["ui/button"]?.installedAs).toBe("transitive");
    expect(beforeManifest.installedComponents?.["ui/dialog"]?.installedAs).toBe("explicit");

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/dialog/dialog.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/shared/portal.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents ?? {}).toEqual({});
  });

  test("explicit installs are preserved as orphans when their dependent is removed", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifestBeforeRemove = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifestBeforeRemove.installedComponents?.["ui/button"]?.installedAs).toBe("explicit");

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/components/ui/dialog/dialog.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(manifest.installedComponents?.["ui/button"]).toBeTruthy();
    expect(manifest.installedComponents?.["ui/dialog"]).toBeUndefined();
  });
});

describe("list command", () => {
  test("list json hides internal items and omits bare aliases by default", () => {
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json"])) as Array<{ name: string }>;
    const names = items.map((item) => item.name);

    expect(names).toContain("ui/button");
    expect(names).not.toContain("button");
    expect(names).not.toContain("ui/theme");
    expect(names).not.toContain("theme");
    expect(names).not.toContain("ui/portal");
    expect(names).not.toContain("ui/dialog-shell");
    expect(names).not.toContain("keys/focusable");
    expect(names.length).toBe(new Set(names).size);
  });

  test("list json --all includes hidden internal items once", () => {
    const items = JSON.parse(runDgadd(["list", "--cwd", root, "--json", "--all"])) as Array<{ name: string }>;
    const names = items.map((item) => item.name);

    expect(names.filter((name) => name === "ui/portal").length).toBe(1);
    expect(names.filter((name) => name === "ui/dialog-shell").length).toBe(1);
    expect(names.filter((name) => name === "keys/focusable").length).toBe(1);
    expect(names.length).toBe(new Set(names).size);
  });
});

describe("diff command", () => {
  test("default scope detects drift in hidden transitives", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const portalSource = join(root, "src/components/ui/shared/portal.tsx");
    writeFileSync(portalSource, `${readFileSync(portalSource, "utf-8")}\n// user drift\n`);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/ui\/portal/);
    expect(output).toMatch(/user drift/);
    expect(output).toMatch(/Summary:.*changed/);
  });

  test("accepts hidden transitive names as explicit arguments", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const portalSource = join(root, "src/components/ui/shared/portal.tsx");
    writeFileSync(portalSource, `${readFileSync(portalSource, "utf-8")}\n// user drift\n`);

    const output = runDgadd(["diff", "ui/portal", "--cwd", root], { silent: false });
    expect(output).toMatch(/user drift/);
  });
});

describe("css ownership", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("add records css chunk ownership in the manifest", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const chunkOwner = Object.values(manifest.installedComponents as Record<string, { cssChunks?: string[] }>)
      .find((entry) => (entry.cssChunks ?? []).length > 0);
    expect(chunkOwner, "at least one item records cssChunks").toBeTruthy();
  });

  test("remove cleans CSS chunks it owns when no retained item owns them", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const cssBefore = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssBefore).toMatch(/dialog::backdrop/);
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssBefore.match(markerPattern) ?? []).length).toBeGreaterThan(0);

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    const cssAfter = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssAfter).not.toMatch(/dialog::backdrop/);
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(0);
  });
});

describe("css chunk drift detection", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("clean install reports zero CSS chunk drift entries", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).not.toMatch(/styles\.css~chunk-/);
  });

  test("user edit inside a CSS chunk surfaces as drift", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const stylesContent = readFileSync(stylesPath, "utf-8");
    const perturbed = stylesContent.replace(
      /(dialog::backdrop)/,
      "/* user added comment */\n$1",
    );
    expect(perturbed).not.toBe(stylesContent);
    writeFileSync(stylesPath, perturbed);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);
    expect(output).toMatch(/user added comment/);
    expect(output).toMatch(/Summary:.*changed/);
  });

  test("missing chunk in styles.css surfaces as drift", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const stylesContent = readFileSync(stylesPath, "utf-8");
    const chunkStripped = stylesContent.replace(
      /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\/[\s\S]*?\/\* dgadd:css-end [a-f0-9]{16}(?: \S+)? \*\/\n*/g,
      "",
    );
    expect(chunkStripped).not.toMatch(/dialog::backdrop/);
    writeFileSync(stylesPath, chunkStripped);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);
    expect(output).toMatch(/dialog::backdrop/);
    expect(output).toMatch(/Summary:.*changed/);
  });
});

describe("css chunk ownership on remove", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("shared chunk is preserved when one of two co-owners is removed", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    // dialog.css is keyed under its owning registry item (a transitive); pull
    // whichever manifest entry recorded chunks so the assertion does not bind
    // to which item happens to own the shared CSS today.
    const chunkOwnerEntry = Object.entries(manifest.installedComponents as Record<string, { cssChunks?: string[] }>)
      .find(([, record]) => (record.cssChunks ?? []).length > 0);
    expect(chunkOwnerEntry, "expected at least one item to record cssChunks").toBeTruthy();
    const ownerHashes = chunkOwnerEntry![1].cssChunks!;

    // Grant the same chunk hashes to ui/button (explicit, so it is preserved
    // when ui/dialog is removed). Models two registry items emitting identical
    // CSS — the chunk must survive removal of the first co-owner.
    manifest.installedComponents["ui/button"].cssChunks = [...ownerHashes];
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(manifest, null, 2));

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    const cssAfter = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssAfter).toMatch(/dialog::backdrop/);
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(ownerHashes.length);

    const finalManifest = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(finalManifest.installedComponents?.["ui/button"]).toBeTruthy();
  });

  test("unique chunks of a removed item are deleted from styles.css", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const cssBefore = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssBefore.match(markerPattern) ?? []).length).toBeGreaterThan(0);
    expect(cssBefore).toMatch(/dialog::backdrop/);

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    const cssAfter = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssAfter).not.toMatch(/dialog::backdrop/);
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(0);
  });
});

describe("integration modes", () => {
  test("copy integration installs keys transitive files with bundler-safe relative imports", () => {
    runDgadd(["add", "ui/select", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).not.toMatch(
      /from "\.\/utils\/navigation-dispatch\.js"/,
    );
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).toMatch(
      /from "\.\/utils\/navigation-dispatch"/,
    );
    expect(readFileSync(join(root, "src/hooks/use-navigation.ts"), "utf-8")).toMatch(
      /from "\.\/utils\/navigation-items"/,
    );
  });

  test("copy integration rewrites package-root keys imports to copied sources", () => {
    runDgadd(["add", "ui/accordion", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    const content = readFileSync(join(root, "src/components/ui/accordion/accordion.tsx"), "utf-8");
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/utils\/navigation-items/);
  });

  test("copy integration installs focusable utilities for popover-backed UI", () => {
    runDgadd(["add", "ui/popover", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(true);

    const content = readFileSync(join(root, "src/components/ui/popover/use-auto-focus.ts"), "utf-8");
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/utils\/focusable/);
  });

  test("copy integration installs focus restore for dialog-backed UI", () => {
    runDgadd(["add", "ui/command-palette", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(true);

    const content = readFileSync(
      join(root, "src/components/ui/command-palette/command-palette-content.tsx"),
      "utf-8",
    );
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/use-focus-restore/);
  });

  test("copy integration installs navigation for radio-backed UI", () => {
    runDgadd(["add", "ui/radio", "--integration", "copy", "--cwd", root, "--yes", "--skip-install"]);

    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-dispatch.ts"))).toBe(true);
    expect(existsSync(join(root, "src/hooks/utils/navigation-items.ts"))).toBe(true);

    const content = readFileSync(join(root, "src/components/ui/radio/radio-group.tsx"), "utf-8");
    expect(content).not.toMatch(/@diffgazer\/keys/);
    expect(content).toMatch(/@\/hooks\/use-navigation/);
  });

  test("none integration is rejected when selected components require keys hooks", () => {
    expect(
      () => runDgadd(["add", "ui/select", "--integration", "none", "--cwd", root, "--yes", "--skip-install"]),
    ).toThrow(/require keyboard hooks|Components reference keyboard hooks/);
    expect(existsSync(join(root, "src/components/ui/select/select.tsx"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
  });

  test("none integration installs components that do not require keys hooks", () => {
    runDgadd(["add", "ui/button", "--integration", "none", "--cwd", root, "--yes", "--skip-install"]);

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
    expect(config.installedComponents["ui/button"].integrationMode).toBe("none");
  });

  test("keys package integration diff is up to date immediately after add", () => {
    runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

    const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
    expect(readFileSync(selectContentSource, "utf-8")).toMatch(/from "@diffgazer\/keys"/);

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    expect(output).toMatch(/All Diffgazer items are up to date with registry\./);
  });

  test("keys package integration diff reports modified installed files", () => {
    runDgadd(["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"]);

    const selectContentSource = join(root, "src/components/ui/select/select-content.tsx");
    writeFileSync(selectContentSource, `${readFileSync(selectContentSource, "utf-8")}\n// user edit\n`);

    const output = runDgadd(["diff", "ui/select", "--cwd", root], { silent: false });
    expect(output).toMatch(/Summary: \d+ changed/);
    expect(output).toMatch(/user edit/);
  });
});

describe("ownership boundaries", () => {
  test("remove of remaining co-owner deletes shared files when other co-owner was manually purged from manifest", () => {
    runDgadd(["add", "keys/focus-trap", "keys/focus-restore", "--cwd", root, "--yes", "--skip-install"]);

    const before = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(before.installedComponents?.["keys/focus-trap"]).toBeTruthy();
    expect(before.installedComponents?.["keys/focus-restore"]).toBeTruthy();

    delete before.installedComponents["keys/focus-restore"];
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(before, null, 2));

    runDgadd(["remove", "keys/focus-trap", "--cwd", root, "--yes"]);

    expect(existsSync(join(root, "src/hooks/use-focus-trap.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/use-focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focus-restore.ts"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/utils/focusable.ts"))).toBe(false);

    const updated = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updated.installedComponents?.["keys/focus-trap"]).toBeUndefined();
    expect(updated.installedComponents?.["keys/focus-restore"]).toBeUndefined();
  });

  test("add --overwrite replaces a locally-modified owned file and updates the ownership hash", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    const initialConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const initialHash = initialConfig.installedComponents["ui/button"].files
      .find((file: { path: string }) => file.path === "src/components/ui/button/index.ts")?.hash;
    expect(initialHash, "initial install should hash the index file").toBeTruthy();

    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install", "--overwrite"]);

    const reinstalledContent = readFileSync(buttonIndex, "utf-8");
    expect(reinstalledContent).not.toBe("// user edits\n");

    const updatedConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    const updatedHash = updatedConfig.installedComponents["ui/button"].files
      .find((file: { path: string }) => file.path === "src/components/ui/button/index.ts")?.hash;
    expect(updatedHash, "reinstalled content matches registry, so the recorded hash is unchanged").toBe(initialHash);
  });

  test("add without --overwrite keeps locally-modified content and does not corrupt the existing ownership entry", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    const buttonIndex = join(root, "src/components/ui/button/index.ts");
    writeFileSync(buttonIndex, "// user edits\n");

    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);

    expect(readFileSync(buttonIndex, "utf-8")).toBe("// user edits\n");

    const updatedConfig = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8"));
    expect(updatedConfig.installedComponents?.["ui/button"]).toBeTruthy();
  });
});
