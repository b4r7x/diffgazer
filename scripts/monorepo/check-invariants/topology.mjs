import {
  existsInRoot,
  invariantResult,
  parseGitIndexPaths,
  parseLines,
  readJsonInRoot,
  readTextInRoot,
} from "./context.mjs";

const EXPECTED_WORKSPACE_GLOBS = [
  "apps/*",
  "cli/*",
  "libs/*",
  "libs/keys/artifacts",
  "libs/keys/examples/*",
];

// Every workspace with visual baselines points Playwright's snapshotDir at its own
// tests/e2e/baselines (apps/docs and apps/web today), so the invariant is that a screenshot
// lives under some workspace's baselines directory rather than beside its spec file.
const E2E_BASELINE_DIR_RE = /^[^/]+\/[^/]+\/tests\/e2e\/baselines\//;
const PLAYWRIGHT_SCREENSHOT_RE = /\.e2e\.ts-snapshots\/[^/]+\.png$/;

export function checkRootWorkspaceFile(context) {
  return invariantResult(
    "root workspace file exists",
    existsInRoot(context, "pnpm-workspace.yaml"),
  );
}

export function checkRootPolicyFiles(context) {
  return invariantResult(
    "root policy files exist",
    existsInRoot(context, "SECURITY.md") && existsInRoot(context, "SUPPORT.md"),
  );
}

export function checkRootMetadata(context) {
  const pkg = readJsonInRoot(context, "package.json");
  const missing = [];

  if (pkg.repository?.url !== "git+https://github.com/b4r7x/diffgazer.git") {
    missing.push(`repository.url: ${pkg.repository?.url}`);
  }
  if (pkg.homepage !== "https://github.com/b4r7x/diffgazer") {
    missing.push(`homepage: ${pkg.homepage}`);
  }
  if (pkg.bugs?.url !== "https://github.com/b4r7x/diffgazer/issues") {
    missing.push(`bugs.url: ${pkg.bugs?.url}`);
  }

  return invariantResult("root repository metadata", missing.length === 0, missing.join("; "));
}

export function checkWorkspaceGlobs(context) {
  const workspaceYaml = readTextInRoot(context, "pnpm-workspace.yaml");
  const globs = workspaceYaml
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/"|'/g, ""));

  return invariantResult(
    "workspace globs match target roots",
    JSON.stringify(globs.slice().sort()) === JSON.stringify(EXPECTED_WORKSPACE_GLOBS),
    `found ${JSON.stringify(globs)}`,
  );
}

export function checkNoGitmodules(context) {
  return invariantResult("no .gitmodules", !existsInRoot(context, ".gitmodules"));
}

export function checkNoGitlinkEntries(context) {
  const gitLinks = parseLines(context.commandOutputs.gitLsFilesStaged)
    .filter((line) => line.startsWith("160000 "))
    .map((line) => line.split(/\s+/).at(-1) ?? "")
    .filter(Boolean);

  return invariantResult(
    "no gitlink entries",
    gitLinks.length === 0,
    gitLinks.slice(0, 10).join(", "),
  );
}

export function checkNoNestedRepoConfig(context) {
  const nestedRepoConfig = String(context.commandOutputs.nestedRepoConfig ?? "");
  return invariantResult(
    "no nested repo config",
    nestedRepoConfig.length === 0,
    nestedRepoConfig.split("\n").slice(0, 10).join(", "),
  );
}

export function checkNoNestedGitDirectories(context) {
  const nestedGitDirs = parseLines(context.commandOutputs.nestedGitDirs);
  return invariantResult(
    "no nested .git directories",
    nestedGitDirs.length === 0,
    nestedGitDirs.slice(0, 5).join(", "),
  );
}

export function checkNoNestedPnpmLocks(context) {
  const nestedLocks = parseLines(context.commandOutputs.nestedLocks);
  return invariantResult(
    "no nested pnpm-lock.yaml",
    nestedLocks.length === 0,
    nestedLocks.slice(0, 5).join(", "),
  );
}

export function checkNoNestedPnpmWorkspaces(context) {
  const nestedWorkspaces = parseLines(context.commandOutputs.nestedWorkspaces);
  return invariantResult(
    "no nested pnpm-workspace.yaml",
    nestedWorkspaces.length === 0,
    nestedWorkspaces.slice(0, 5).join(", "),
  );
}

export function checkE2eScreenshotsUseBaselineDirectory(context) {
  const misplaced = parseGitIndexPaths(context.commandOutputs.gitLsFilesStaged)
    .filter((path) => existsInRoot(context, path))
    .filter((path) => PLAYWRIGHT_SCREENSHOT_RE.test(path))
    .filter((path) => !E2E_BASELINE_DIR_RE.test(path));

  return invariantResult(
    "e2e screenshots use configured baseline directory",
    misplaced.length === 0,
    misplaced.slice(0, 5).join(", "),
  );
}

export function checkTurboDocsBuildIncludesOutput(context) {
  const turboConfig = readJsonInRoot(context, "turbo.json");
  const docsOutputs = turboConfig.tasks?.["@diffgazer/docs#build"]?.outputs ?? [];
  return invariantResult(
    "turbo docs build includes .output",
    docsOutputs.includes(".output/**"),
    `outputs: ${JSON.stringify(docsOutputs)}`,
  );
}

function isWebTurboBuildCommand(script) {
  if (/[;&|#\n\r]/.test(script)) return false;

  const tokens = script.trim().split(/\s+/);
  const turboIndex = tokens[0] === "pnpm" && tokens[1] === "exec" ? 2 : 0;
  if (
    tokens[turboIndex] !== "turbo" ||
    tokens[turboIndex + 1] !== "run" ||
    tokens[turboIndex + 2] !== "build"
  ) {
    return false;
  }

  const args = tokens.slice(turboIndex + 3);
  if (args.length === 1) return args[0] === "--filter=@diffgazer/web";
  return args.length === 2 && args[0] === "--filter" && args[1] === "@diffgazer/web";
}

export function checkWebBuildUsesTurbo(context) {
  const rootPkg = readJsonInRoot(context, "package.json");
  const webBuildScript = rootPkg.scripts?.["web:build"] ?? "";
  return invariantResult(
    "web:build uses turbo for dependency chain",
    isWebTurboBuildCommand(webBuildScript),
    webBuildScript,
  );
}
