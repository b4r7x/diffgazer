import { posix } from "node:path";
import { parse as parseYaml } from "yaml";
import { existsInRoot, invariantResult, readJsonInRoot, readTextInRoot } from "./context.mjs";

const PNPM_DOCKERFILES = ["Dockerfile", "deploy/landing.Dockerfile"];
const DOCKER_ARTIFACT_FORMATTER_INPUTS = ["biome.json", ".gitignore"];

export function checkPnpmPinsMatchRootPackageManager(context) {
  const packageManager = readJsonInRoot(context, "package.json").packageManager;
  const expected = `corepack prepare ${packageManager} --activate`;
  const mismatches = PNPM_DOCKERFILES.filter(
    (file) => !existsInRoot(context, file) || !readTextInRoot(context, file).includes(expected),
  );

  return invariantResult(
    "pnpm pins match root packageManager",
    typeof packageManager === "string" &&
      packageManager.startsWith("pnpm@") &&
      mismatches.length === 0,
    mismatches.join(", "),
  );
}

function parseDockerInstructions(content) {
  const instructions = [];
  let logicalLine = "";

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#")) continue;
    if (logicalLine === "" && trimmed === "") continue;

    const continued = line.endsWith("\\");
    const fragment = continued ? line.slice(0, -1) : line;
    logicalLine = logicalLine === "" ? fragment : `${logicalLine} ${fragment.trimStart()}`;
    if (continued) continue;

    const match = /^\s*([a-z]+)(?:\s+([\s\S]*))?$/i.exec(logicalLine);
    if (match) instructions.push({ name: match[1].toUpperCase(), arguments: match[2] ?? "" });
    logicalLine = "";
  }

  return instructions;
}

function stripDockerInstructionOptions(argumentsText) {
  let command = argumentsText.trimStart();
  const optionPattern = /^--[a-z][a-z0-9-]*(?:=(?:"(?:\\.|[^"])*"|'[^']*'|\S+))?(?:\s+|$)/i;

  while (command.startsWith("--")) {
    const option = optionPattern.exec(command);
    if (!option) break;
    command = command.slice(option[0].length).trimStart();
  }

  return command;
}

const PNPM_INSTALL_COMMAND = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*pnpm\s+install\b/;
const FROZEN_LOCKFILE_FLAG = /\s--frozen-lockfile(?![\w=-])/;

/**
 * Shell form only. JSON exec form (`RUN ["pnpm", "install"]`) runs no shell, so
 * the `&&`/`;` splitting and the flag regexes below do not describe it; the
 * repo's Dockerfiles are shell form throughout. Bailing out keeps exec form
 * explicitly out of scope instead of silently misreading the JSON as words.
 */
function hasFrozenPnpmInstall(argumentsText) {
  const command = stripDockerInstructionOptions(argumentsText);
  if (command.startsWith("[")) return false;

  return command
    .split(/&&|\|\||[;|]/)
    .some((segment) => PNPM_INSTALL_COMMAND.test(segment) && FROZEN_LOCKFILE_FLAG.test(segment));
}

export function checkDockerArtifactFormatterInputs(context) {
  const missing = PNPM_DOCKERFILES.flatMap((file) => {
    if (!existsInRoot(context, file)) return [`${file}: missing Dockerfile`];

    const copiedSources = new Set(
      parseDockerInstructions(readTextInRoot(context, file))
        .filter((instruction) => instruction.name === "COPY")
        .flatMap((instruction) => parseDockerCopySources(instruction.arguments)),
    );

    return DOCKER_ARTIFACT_FORMATTER_INPUTS.filter((input) => !copiedSources.has(input)).map(
      (input) => `${file}: ${input}`,
    );
  });

  return invariantResult(
    "Docker artifact builds copy formatter inputs",
    missing.length === 0,
    missing.join(", "),
  );
}

function parseDockerCopySources(argumentsText) {
  return parseDockerCopy(argumentsText)?.sources ?? [];
}

/** Shell form only — see hasFrozenPnpmInstall. JSON exec form is skipped, not guessed at. */
function parseDockerCopy(argumentsText) {
  const text = stripDockerInstructionOptions(argumentsText);
  if (text.startsWith("[")) return null;

  const args = text.split(/\s+/).filter(Boolean);

  if (args.length < 2) return null;
  return {
    sources: args.slice(0, -1).map((source) => source.replace(/^\.\//, "").replace(/\/$/, "")),
    destination: args.at(-1),
    destinationIsDirectory: args.length > 2 || args.at(-1).endsWith("/"),
  };
}

function dockerCopyTarget(copy, source, path) {
  const destination = copy.destination;
  if (source === "." || path.startsWith(`${source}/`)) {
    const relativePath = source === "." ? path : path.slice(source.length + 1);
    return posix.join(destination, relativePath);
  }
  if (source !== path) return null;
  if (copy.destinationIsDirectory || destination === "." || destination === "..") {
    return posix.join(destination, posix.basename(source));
  }
  return destination;
}

function resolveDockerContainerPath(path, workdir) {
  if (posix.isAbsolute(path)) return posix.normalize(path);
  return workdir === null ? null : posix.join(workdir, path);
}

function dockerCopyCoversPath(copy, path, installWorkdir) {
  return copy.sources.some((source) => {
    const target = dockerCopyTarget(copy, source, path);
    if (!target) return false;
    const targetPath = resolveDockerContainerPath(target, copy.workdir);
    const expectedPath =
      installWorkdir === null ? null : resolveDockerContainerPath(path, installWorkdir);
    return targetPath !== null && expectedPath !== null && targetPath === expectedPath;
  });
}

function resolveDockerWorkdir(argumentsText, currentWorkdir) {
  const workdir = argumentsText.trim();
  if (workdir === "" || workdir.includes("$")) return null;
  if (posix.isAbsolute(workdir)) return posix.normalize(workdir);
  return currentWorkdir === null ? null : posix.join(currentWorkdir, workdir);
}

function collectMissingCopiesBeforeFrozenInstalls(context, file, requiredPaths) {
  const missing = [];
  const copies = [];
  let workdir = ".";
  let stage = 0;

  for (const instruction of parseDockerInstructions(readTextInRoot(context, file))) {
    if (instruction.name === "FROM") {
      copies.length = 0;
      workdir = ".";
      stage += 1;
      continue;
    }
    if (instruction.name === "WORKDIR") {
      workdir = resolveDockerWorkdir(instruction.arguments, workdir);
      continue;
    }
    if (instruction.name === "COPY") {
      const copy = parseDockerCopy(instruction.arguments);
      if (copy) copies.push({ ...copy, workdir });
    }
    if (instruction.name !== "RUN" || !hasFrozenPnpmInstall(instruction.arguments)) continue;

    for (const path of requiredPaths) {
      if (!copies.some((copy) => dockerCopyCoversPath(copy, path, workdir))) {
        missing.push(`${file}: stage ${stage}: ${path}`);
      }
    }
  }

  return missing;
}

function dockerfilePaths(context) {
  return context.repoFiles.filter((path) => /(^|\/)(?:Dockerfile|[^/]+\.Dockerfile)$/.test(path));
}

export function checkDockerFrozenInstallsCopyPatches(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  const patchPaths = Object.values(workspace?.patchedDependencies ?? {}).filter(
    (path) => typeof path === "string",
  );
  const missing = dockerfilePaths(context).flatMap((file) =>
    collectMissingCopiesBeforeFrozenInstalls(context, file, patchPaths),
  );

  return invariantResult(
    "Docker frozen installs copy configured patches",
    missing.length === 0,
    missing.join(", "),
  );
}

function workspaceGlobToManifestPattern(glob) {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", "[^/]+");
  return new RegExp(`^${escaped}/package\\.json$`);
}

// `pnpm install --offline` resolves every workspace importer from the lockfile,
// so an image that copies manifests one by one has to copy all of them: a new
// workspace otherwise makes the frozen install abort on an importer count the
// image never provided.
export function checkDockerCopiesWorkspaceManifests(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  const globs = (Array.isArray(workspace?.packages) ? workspace.packages : []).filter(
    (glob) => typeof glob === "string",
  );
  const patterns = globs.map(workspaceGlobToManifestPattern);
  const manifests = context.repoFiles
    .filter((path) => patterns.some((pattern) => pattern.test(path)))
    .sort();
  const missing = dockerfilePaths(context).flatMap((file) =>
    collectMissingCopiesBeforeFrozenInstalls(context, file, manifests),
  );

  return invariantResult(
    "Docker frozen installs copy workspace manifests",
    missing.length === 0,
    missing.slice(0, 10).join(", "),
  );
}
