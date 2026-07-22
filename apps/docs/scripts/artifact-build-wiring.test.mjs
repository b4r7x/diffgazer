import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-docs-build-wiring-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function fakeBuildCommandSource() {
  return `#!${process.execPath}
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const command = basename(process.argv[1]);
const args = process.argv.slice(2);
const workspace = process.env.BUILD_RECORDER_WORKSPACE;
const statePath = process.env.BUILD_RECORDER_STATE;
const addRoot = join(workspace, "cli/add");
const docsRoot = join(workspace, "apps/docs");

function record(event) {
  const state = JSON.parse(readFileSync(statePath, "utf-8"));
  state.events.push(event);
  writeFileSync(statePath, JSON.stringify(state));
}

function runPackageScript(cwd, name, env = process.env) {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  const script = pkg.scripts && pkg.scripts[name];
  if (!script) {
    console.error("Missing fixture package script: " + name);
    process.exit(1);
  }
  const result = spawnSync("sh", ["-c", script], { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function generateBundles() {
  record("generate:bundles");
  const generatedRoot = join(addRoot, "src/generated");
  mkdirSync(generatedRoot, { recursive: true });
  for (const name of ["registry-bundle.json", "keys-copy-bundle.json", "keys-version.json"]) {
    writeFileSync(join(generatedRoot, name), JSON.stringify({ name }) + "\\n");
  }
}

function runFilteredPackage() {
  const filter = args[1];
  const name = args[2] === "run" ? args[3] : args[2];
  if (filter === "@diffgazer/add" && name === "generate:bundles") {
    generateBundles();
    return;
  }
  if (filter === "@diffgazer/docs") {
    runPackageScript(docsRoot, name);
    return;
  }
  record("filter:" + filter + ":" + name);
}

function runTurboBuild() {
  const turbo = JSON.parse(readFileSync(join(workspace, "turbo.json"), "utf-8"));
  const addBuild = turbo.tasks["@diffgazer/add#build"];
  if (addBuild.dependsOn.includes("generate:bundles")) generateBundles();

  const taskEnv = { ...process.env };
  delete taskEnv.DIFFGAZER_SKIP_ARTIFACT_PREPARE;
  for (const name of turbo.globalPassThroughEnv || []) {
    if (process.env[name] !== undefined) taskEnv[name] = process.env[name];
  }

  runPackageScript(addRoot, "build", taskEnv);
  runPackageScript(docsRoot, "build", taskEnv);
}

if (command === "pnpm") {
  if (args[0] === "--filter") {
    runFilteredPackage();
  } else if (args[0] === "exec" && args[1] === "turbo" && args[2] === "run" && args[3] === "build") {
    runTurboBuild();
  } else {
    const name = args[0] === "run" ? args[1] : args[0];
    if (name === "generate:bundles") {
      generateBundles();
    } else {
      runPackageScript(process.cwd(), name);
    }
  }
} else if (command === "node") {
  const target = args.find((arg) => arg.endsWith(".mjs") || arg.endsWith(".ts"));
  if (target && target.endsWith("prepare-generated.mjs")) {
    record("docs:prepare:" + (process.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE || "unset"));
    if (process.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE !== "1") record("nested:prepare-library-artifacts");
  } else if (target && target.endsWith("validate-artifacts.mjs")) {
    record("validate:artifacts");
  } else {
    record("node:" + (target || args.join(" ")));
  }
} else {
  record(command + ":" + args.join(" "));
}
`;
}

function createBuildRecorderFixture(sourceWorkspaceRoot) {
  const root = makeTempRoot();
  const binRoot = join(root, "bin");
  const statePath = join(root, "build-state.json");
  const manifests = [
    "package.json",
    "cli/add/package.json",
    "apps/docs/package.json",
    "turbo.json",
  ];

  for (const manifest of manifests) {
    writeJson(root, manifest, readJson(join(sourceWorkspaceRoot, manifest)));
  }
  writeJson(root, "build-state.json", { events: [] });
  mkdirSync(binRoot);

  const source = fakeBuildCommandSource();
  for (const command of ["biome", "node", "pnpm", "tsup", "vite"]) {
    const path = join(binRoot, command);
    writeFileSync(path, source, { mode: 0o755 });
    chmodSync(path, 0o755);
  }

  return {
    root,
    addRoot: join(root, "cli/add"),
    statePath,
    env: {
      ...process.env,
      BUILD_RECORDER_STATE: statePath,
      BUILD_RECORDER_WORKSPACE: root,
      PATH: `${binRoot}${delimiter}${process.env.PATH ?? ""}`,
    },
  };
}

function readBuildEvents(statePath) {
  return readJson(statePath).events;
}

function hashFiles(paths) {
  return paths.map((path) => createHash("sha256").update(readFileSync(path)).digest("hex"));
}

describe("artifact build wiring", () => {
  it("keeps root builds single-writer while direct Add builds remain self-contained", () => {
    const sourceWorkspaceRoot = join(import.meta.dirname, "../../..");
    const rootPackage = readJson(join(sourceWorkspaceRoot, "package.json"));
    const addPackage = readJson(join(sourceWorkspaceRoot, "cli/add/package.json"));
    const fixture = createBuildRecorderFixture(sourceWorkspaceRoot);
    const bundlePaths = ["registry-bundle.json", "keys-copy-bundle.json", "keys-version.json"].map(
      (name) => join(fixture.addRoot, "src/generated", name),
    );

    execFileSync("sh", ["-c", rootPackage.scripts.build], {
      cwd: fixture.root,
      env: fixture.env,
    });

    const rootBuildEvents = readBuildEvents(fixture.statePath);
    expect(rootBuildEvents.filter((event) => event === "generate:bundles")).toHaveLength(1);
    expect(rootBuildEvents).not.toContain("nested:prepare-library-artifacts");
    expect(rootBuildEvents.filter((event) => event === "docs:prepare:1")).toHaveLength(2);
    for (const path of bundlePaths) expect(existsSync(path)).toBe(true);

    const preparedHashes = hashFiles(bundlePaths);
    execFileSync("sh", ["-c", rootPackage.scripts["validate:artifacts:check"]], {
      cwd: fixture.root,
      env: fixture.env,
    });
    expect(hashFiles(bundlePaths)).toEqual(preparedHashes);
    expect(readBuildEvents(fixture.statePath)).toContain("validate:artifacts");

    for (const path of bundlePaths) rmSync(path);
    const directBuildEnv = { ...fixture.env };
    delete directBuildEnv.DIFFGAZER_SKIP_ARTIFACT_PREPARE;
    execFileSync("sh", ["-c", addPackage.scripts.build], {
      cwd: fixture.addRoot,
      env: directBuildEnv,
    });

    const finalEvents = readBuildEvents(fixture.statePath);
    expect(finalEvents.filter((event) => event === "generate:bundles")).toHaveLength(2);
    expect(hashFiles(bundlePaths)).toEqual(preparedHashes);
  }, 30_000);

  it("keeps the removed package-sync mode absent from public and build contracts", () => {
    const workspaceRoot = join(import.meta.dirname, "../../..");
    const contractFiles = [
      "turbo.json",
      "PACKAGE_GOVERNANCE.md",
      "apps/docs/README.md",
      "apps/docs/scripts/prepare-generated.mjs",
      "apps/docs/scripts/sync-artifacts.mjs",
    ];

    for (const file of contractFiles) {
      expect(readFileSync(join(workspaceRoot, file), "utf-8")).not.toContain(
        "DIFFGAZER_ARTIFACT_SYNC_MODE",
      );
    }
  });
});
