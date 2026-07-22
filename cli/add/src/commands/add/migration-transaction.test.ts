import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCli, PACKAGE_MANAGER_LOCKFILES } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import { addCommand } from "./command.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

interface InstalledManifest {
  installedComponents: Record<
    string,
    {
      installedAs?: "explicit" | "transitive";
      integrationMode?: "none" | "copy" | "@diffgazer/keys";
      files?: Array<{
        path: string;
        integrationMode?: "none" | "copy" | "@diffgazer/keys";
      }>;
    }
  >;
}

function runDgadd(args: string[]): void {
  execFileSync(
    process.execPath,
    ["--import", "tsx", resolve(repoRoot, "cli/add/src/index.ts"), "--silent", ...args],
    { cwd: repoRoot },
  );
}

function readManifest(root: string): InstalledManifest {
  return JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as InstalledManifest;
}

function snapshotOwnedFiles(
  root: string,
  manifest: InstalledManifest,
  prefix: "ui/" | "keys/",
): Map<string, Buffer> {
  const snapshots = new Map<string, Buffer>();
  for (const [name, record] of Object.entries(manifest.installedComponents)) {
    if (!name.startsWith(prefix)) continue;
    for (const file of record.files ?? []) {
      const path = resolve(root, file.path);
      if (existsSync(path)) snapshots.set(path, readFileSync(path));
    }
  }
  return snapshots;
}

function expectFilesRestored(snapshots: ReadonlyMap<string, Buffer>): void {
  for (const [path, content] of snapshots) {
    expect(readFileSync(path)).toEqual(content);
  }
}

describe("integration migration transaction", () => {
  let root: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-integration-rollback-"));
    originalPath = process.env.PATH;
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    );
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify(
        {
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
        },
        null,
        2,
      )}\n`,
    );
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  test("restores copy migration and package-manager state when finalization fails", async () => {
    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "copy",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);

    const manifestPath = join(root, "diffgazer.json");
    const manifestBytes = readFileSync(manifestPath);
    const manifest = readManifest(root);
    const componentSnapshots = snapshotOwnedFiles(root, manifest, "ui/");
    const hookSnapshots = snapshotOwnedFiles(root, manifest, "keys/");
    const copiedOwnershipNames = Object.keys(manifest.installedComponents).filter((name) =>
      name.startsWith("keys/"),
    );
    const dependencyOwnership = manifest.installedComponents["keys/navigation"];
    const selectNavigationPath = join(root, "src/components/ui/select/use-content-navigation.ts");
    const copySelectNavigation = readFileSync(selectNavigationPath, "utf-8");

    expect(componentSnapshots.size).toBeGreaterThan(0);
    expect(hookSnapshots.size).toBeGreaterThan(0);
    expect(copiedOwnershipNames.length).toBeGreaterThan(0);
    expect(dependencyOwnership?.installedAs).toBe("transitive");

    const packagePath = join(root, "package.json");
    const packageBytes = Buffer.from(
      `${JSON.stringify(
        {
          type: "module",
          packageManager: "pnpm@10.0.0",
          dependencies: { existing: "^1.0.0" },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(packagePath, packageBytes);

    const lockfileSnapshots = new Map<string, Buffer | null>();
    for (const [index, lockfile] of PACKAGE_MANAGER_LOCKFILES.entries()) {
      const path = join(root, lockfile);
      const content = index % 2 === 0 ? Buffer.from(`original ${lockfile}\n`) : null;
      if (content) writeFileSync(path, content);
      else rmSync(path, { force: true });
      lockfileSnapshots.set(path, content);
    }

    const fakeBin = join(root, "fake-bin");
    const installMarker = join(root, ".fake-pm-ran");
    mkdirSync(fakeBin);
    const fakePnpm = join(fakeBin, "pnpm");
    writeFileSync(
      fakePnpm,
      [
        "#!/bin/sh",
        `printf '%s\\n' '{"dependencies":{"transaction-mutated":"1.0.0"}}' > '${packagePath}'`,
        ...PACKAGE_MANAGER_LOCKFILES.map(
          (lockfile) => `printf '%s\\n' 'mutated ${lockfile}' > '${join(root, lockfile)}'`,
        ),
        `printf '%s\\n' 'ran' > '${installMarker}'`,
      ].join("\n"),
    );
    chmodSync(fakePnpm, 0o755);
    process.env.PATH = `${fakeBin}:${originalPath ?? ""}`;

    const writeConfigImpl = ctx.config.writeConfig;
    let stateAtFinalizationFailure:
      | {
          componentMigrated: boolean;
          hooksRemoved: boolean;
          manifestMigrated: boolean;
          componentOwnershipMigrated: boolean;
          copiedOwnershipRemoved: boolean;
          packageMutated: boolean;
          lockfilesMutated: boolean;
        }
      | undefined;
    vi.spyOn(ctx.config, "writeConfig").mockImplementation((cwd, config) => {
      writeConfigImpl(cwd, config);
      const migratedManifest = readManifest(root);
      const migratedSelect = migratedManifest.installedComponents["ui/select"];
      const migratedSelectFiles = migratedSelect?.files ?? [];
      stateAtFinalizationFailure = {
        componentMigrated:
          readFileSync(selectNavigationPath, "utf-8") !== copySelectNavigation &&
          readFileSync(selectNavigationPath, "utf-8").includes("@diffgazer/keys"),
        hooksRemoved: [...hookSnapshots.keys()].every((path) => !existsSync(path)),
        manifestMigrated: !readFileSync(manifestPath).equals(manifestBytes),
        componentOwnershipMigrated:
          migratedSelect?.integrationMode === "@diffgazer/keys" &&
          migratedSelectFiles.length > 0 &&
          migratedSelectFiles.every((file) => file.integrationMode === "@diffgazer/keys"),
        copiedOwnershipRemoved: copiedOwnershipNames.every(
          (name) => migratedManifest.installedComponents[name] === undefined,
        ),
        packageMutated: readFileSync(packagePath, "utf-8").includes("transaction-mutated"),
        lockfilesMutated: PACKAGE_MANAGER_LOCKFILES.every(
          (lockfile) => readFileSync(join(root, lockfile), "utf-8") === `mutated ${lockfile}\n`,
        ),
      };
      throw new Error("forced manifest finalization failure");
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const program = createCli({
      name: "dgadd-test",
      displayName: "DIFFGAZER ADD TEST",
      description: "integration transaction test",
      version: "0.0.0",
      commands: [addCommand],
    });

    await program.parseAsync(
      ["add", "ui/select", "--integration", "keys", "--overwrite", "--cwd", root, "--yes"],
      { from: "user" },
    );

    expect(exit).toHaveBeenCalledWith(1);
    expect(existsSync(installMarker)).toBe(true);
    expect(stateAtFinalizationFailure).toEqual({
      componentMigrated: true,
      hooksRemoved: true,
      manifestMigrated: true,
      componentOwnershipMigrated: true,
      copiedOwnershipRemoved: true,
      packageMutated: true,
      lockfilesMutated: true,
    });
    expectFilesRestored(componentSnapshots);
    expectFilesRestored(hookSnapshots);
    expect(readFileSync(manifestPath)).toEqual(manifestBytes);
    expect(readFileSync(packagePath)).toEqual(packageBytes);
    for (const [path, content] of lockfileSnapshots) {
      if (content) expect(readFileSync(path)).toEqual(content);
      else expect(existsSync(path)).toBe(false);
    }
    expect(readManifest(root).installedComponents["keys/navigation"]).toEqual(dependencyOwnership);

    runDgadd([
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
    expect(readManifest(root).installedComponents["ui/select"]?.integrationMode).toBe(
      "@diffgazer/keys",
    );
  });
});
