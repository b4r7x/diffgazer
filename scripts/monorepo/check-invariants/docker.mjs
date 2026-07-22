import { posix } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  existsInRoot,
  invariantResult,
  readJsonInRoot,
  readTextInRoot,
} from "./context.mjs";

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

function getDockerEscapeCharacter(content) {
  for (const line of content.split(/\r?\n/)) {
    const directive = /^\s*#\s*([a-z]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!directive) break;
    if (directive[1].toLowerCase() === "escape" && ["\\", "`"].includes(directive[2])) {
      return directive[2];
    }
  }

  return "\\";
}

function hasDockerLineContinuation(line, escapeCharacter) {
  if (!line.endsWith(escapeCharacter)) return false;

  let count = 0;
  for (let index = line.length - 1; line[index] === escapeCharacter; index -= 1) count += 1;
  return count % 2 === 1;
}

function parseDockerInstructions(content) {
  const escapeCharacter = getDockerEscapeCharacter(content);
  const instructions = [];
  let logicalLine = "";

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#")) continue;
    if (logicalLine === "" && trimmed === "") continue;

    const continued = hasDockerLineContinuation(line, escapeCharacter);
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

function tokenizeShellCommand(command) {
  const tokens = [];
  let index = 0;

  while (index < command.length) {
    while (/\s/.test(command[index] ?? "")) index += 1;
    if (index >= command.length || command[index] === "#") break;

    const operator = ["&&", "||", ";", "|", "&", "(", ")"].find((value) =>
      command.startsWith(value, index),
    );
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      index += operator.length;
      continue;
    }

    let quote = null;
    let value = "";
    while (index < command.length) {
      const character = command[index];
      if (quote) {
        if (character === quote) {
          quote = null;
        } else if (character === "\\" && quote === '"' && index + 1 < command.length) {
          index += 1;
          value += command[index];
        } else {
          value += character;
        }
        index += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        index += 1;
        continue;
      }
      if (character === "\\" && index + 1 < command.length) {
        index += 1;
        value += command[index];
        index += 1;
        continue;
      }
      if (/\s/.test(character) || [";", "|", "&", "(", ")"].includes(character)) break;
      value += character;
      index += 1;
    }
    tokens.push({ type: "word", value });
  }

  return tokens;
}

function hasFrozenPnpmInstall(argumentsText) {
  const command = stripDockerInstructionOptions(argumentsText);
  if (command.startsWith("[")) {
    try {
      const args = JSON.parse(command);
      return (
        Array.isArray(args) &&
        args[0] === "pnpm" &&
        args[1] === "install" &&
        args.slice(2).includes("--frozen-lockfile")
      );
    } catch {
      return false;
    }
  }

  const tokens = tokenizeShellCommand(command);
  let commandStart = true;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "operator") {
      commandStart = true;
      continue;
    }
    if (!commandStart || /^[A-Za-z_][A-Za-z0-9_]*=/.test(token.value)) continue;
    if (token.value === "pnpm" && tokens[index + 1]?.value === "install") {
      for (let argumentIndex = index + 2; argumentIndex < tokens.length; argumentIndex += 1) {
        if (tokens[argumentIndex].type === "operator") break;
        if (tokens[argumentIndex].value === "--frozen-lockfile") return true;
      }
    }
    commandStart = false;
  }

  return false;
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

function parseDockerCopy(argumentsText) {
  const sources = stripDockerInstructionOptions(argumentsText);
  let args;

  if (sources.startsWith("[")) {
    try {
      args = JSON.parse(sources);
    } catch {
      return null;
    }
    if (!Array.isArray(args) || !args.every((value) => typeof value === "string")) return null;
  } else {
    args = sources.split(/\s+/);
  }

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

export function checkDockerFrozenInstallsCopyPatches(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  const patchPaths = Object.values(workspace?.patchedDependencies ?? {}).filter(
    (path) => typeof path === "string",
  );
  const dockerfiles = context.repoFiles.filter((path) =>
    /(^|\/)(?:Dockerfile|[^/]+\.Dockerfile)$/.test(path),
  );
  const missing = [];

  for (const file of dockerfiles) {
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

      for (const path of patchPaths) {
        if (!copies.some((copy) => dockerCopyCoversPath(copy, path, workdir))) {
          missing.push(`${file}: stage ${stage}: ${path}`);
        }
      }
    }
  }

  return invariantResult(
    "Docker frozen installs copy configured patches",
    missing.length === 0,
    missing.join(", "),
  );
}
