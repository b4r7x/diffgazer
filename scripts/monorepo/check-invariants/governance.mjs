import { parse as parseYaml } from "yaml";
import { existsInRoot, invariantResult, readJsonInRoot, readTextInRoot } from "./context.mjs";
import { LICENSE_MARKERS } from "./licenses.mjs";

function sliceDocSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const after = text.slice(start + marker.length);
  const next = after.search(/\n## /);
  return next === -1 ? after : after.slice(0, next);
}

function readRootWorkspace(context) {
  return parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
}

function getRootOverrides(context) {
  return readRootWorkspace(context)?.overrides ?? {};
}

function readDependencyGovernanceSection(context) {
  if (!existsInRoot(context, "PACKAGE_GOVERNANCE.md")) return null;
  return sliceDocSection(readTextInRoot(context, "PACKAGE_GOVERNANCE.md"), "Dependency Governance");
}

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function versionMajor(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function packageImporterPath(packageFile) {
  return packageFile === "package.json" ? "." : packageFile.replace(/\/package\.json$/, "");
}

function lockfileDependencyVersion(lockfile, packageFile, dependencyName) {
  const importer = lockfile?.importers?.[packageImporterPath(packageFile)];
  const dependency = importer?.devDependencies?.[dependencyName];
  return typeof dependency === "string" ? dependency : dependency?.version;
}

// The governed manifest set is derived from the tracked manifests so a new
// workspace cannot start outside this invariant. These three intentionally
// declare no @types/node; their engines.node is still governed.
const PACKAGES_WITHOUT_NODE_TYPES = new Set([
  "package.json",
  "libs/keys/artifacts/package.json",
  "libs/keys/examples/playground/package.json",
]);

const NODE_VERSION_PIN = /^\s*node-version:\s*([^\s#]+)/gm;
const TSUP_NODE_TARGET = /target:\s*["']node(\d+)["']/;

function isWorkflowFile(repoPath) {
  return /^\.github\/(?:workflows|actions)\/.+\.ya?ml$/.test(repoPath);
}

// The bundler target is a fourth Node declaration, and it is the one that ships:
// emitting for an older major than the runtime downlevels syntax that runtime
// already has. A config that declares no Node target inherits esbuild's default
// and is not a competing declaration, so it is out of scope here.
function collectBundlerTargetProblems(context, ciMajor) {
  if (ciMajor === null) return [];

  return context.repoFiles
    .filter((path) => /(^|\/)tsup\.config\.[cm]?ts$/.test(path))
    .flatMap((file) => {
      const declared = readTextInRoot(context, file).match(TSUP_NODE_TARGET)?.[1];
      const target = versionMajor(declared);
      return target === null || target === ciMajor
        ? []
        : [`${file} targets Node ${target} != CI Node ${ciMajor}`];
    });
}

// Every runner pin, not just the composite action's: a job that calls
// actions/setup-node directly is invisible to a bump that edits only the action.
function collectNodeVersionPins(context) {
  return context.repoFiles.filter(isWorkflowFile).flatMap((file) =>
    [...readTextInRoot(context, file).matchAll(NODE_VERSION_PIN)].map((match) => ({
      file,
      major: versionMajor(match[1]),
    })),
  );
}

export function checkNodeDeclarationsMatchRuntime(context) {
  const name = "Node declarations match supported runtime majors";
  const problems = [];
  const setupPath = ".github/actions/setup-repo/action.yml";
  const setupSource = existsInRoot(context, setupPath) ? readTextInRoot(context, setupPath) : "";
  const ciMajor = versionMajor(setupSource.match(/^\s*node-version:\s*([^\s#]+)/m)?.[1]);
  if (ciMajor === null) problems.push(`${setupPath} has no numeric node-version`);

  for (const pin of collectNodeVersionPins(context)) {
    if (ciMajor !== null && pin.major !== ciMajor) {
      problems.push(`${pin.file} pins Node ${pin.major ?? "missing"} != CI Node ${ciMajor}`);
    }
  }

  problems.push(...collectBundlerTargetProblems(context, ciMajor));

  const workspace = readRootWorkspace(context);
  const overrideMajor = versionMajor(workspace?.overrides?.["@types/node"]);
  if (ciMajor !== null && overrideMajor !== ciMajor) {
    problems.push(`@types/node override major ${overrideMajor ?? "missing"} != CI Node ${ciMajor}`);
  }

  const lockfile = existsInRoot(context, "pnpm-lock.yaml")
    ? parseYaml(readTextInRoot(context, "pnpm-lock.yaml"))
    : null;
  if (!lockfile) problems.push("pnpm-lock.yaml missing");

  for (const packageFile of context.packageFiles) {
    const pkg = context.parsedPackages.get(packageFile);
    const declared = pkg.devDependencies?.["@types/node"];

    if (declared === undefined) {
      if (!PACKAGES_WITHOUT_NODE_TYPES.has(packageFile)) {
        problems.push(`${packageFile} must declare @types/node`);
      }
    } else if (ciMajor !== null) {
      if (versionMajor(declared) !== ciMajor) {
        problems.push(
          `${packageFile} @types/node major ${versionMajor(declared)} != CI Node ${ciMajor}`,
        );
      }

      const resolved = lockfileDependencyVersion(lockfile, packageFile, "@types/node");
      if (versionMajor(resolved) !== ciMajor) {
        problems.push(
          `${packageFile} resolves @types/node major ${versionMajor(resolved)} != ${ciMajor}`,
        );
      }
    }

    const engineMajor = versionMajor(pkg.engines?.node);
    if (ciMajor !== null && engineMajor !== null && engineMajor !== ciMajor) {
      problems.push(`${packageFile} engines.node major ${engineMajor} != CI Node ${ciMajor}`);
    }
  }

  return invariantResult(name, problems.length === 0, problems.slice(0, 10).join("; "));
}

function splitPackageSelector(selector) {
  const separator = selector.lastIndexOf("@");
  if (separator <= 0) return null;
  return {
    packageName: selector.slice(0, separator),
    version: selector.slice(separator + 1),
  };
}

function collectPositiveAllowBuildsProblems(context, workspace) {
  const approvals = Object.entries(workspace.allowBuilds ?? {}).filter(
    ([, isAllowed]) => isAllowed === true,
  );
  if (approvals.length === 0) return [];

  if (!existsInRoot(context, "pnpm-lock.yaml")) {
    return ["pnpm-lock.yaml missing"];
  }

  const rootPackage = readJsonInRoot(context, "package.json");
  const rootDependencies = {
    ...(rootPackage.dependencies ?? {}),
    ...(rootPackage.devDependencies ?? {}),
    ...(rootPackage.optionalDependencies ?? {}),
  };
  const lockfile = parseYaml(readTextInRoot(context, "pnpm-lock.yaml"));
  const resolvedPackages = new Set(Object.keys(lockfile?.packages ?? {}));
  const patchedSelectors = Object.keys(workspace.patchedDependencies ?? {});
  const problems = [];

  for (const [selector] of approvals) {
    const parsed = splitPackageSelector(selector);
    if (!parsed || !EXACT_VERSION.test(parsed.version)) {
      problems.push(`allowBuilds ${selector} must use an exact version`);
      continue;
    }

    if (!resolvedPackages.has(selector)) {
      problems.push(`allowBuilds ${selector} has no matching pnpm-lock.yaml package`);
    }

    const rootSpecifier = rootDependencies[parsed.packageName];
    if (rootSpecifier !== undefined && rootSpecifier !== parsed.version) {
      problems.push(`allowBuilds ${selector} does not match root specifier ${rootSpecifier}`);
    }

    const packagePatches = patchedSelectors.filter(
      (patchedSelector) =>
        splitPackageSelector(patchedSelector)?.packageName === parsed.packageName,
    );
    if (packagePatches.length > 0 && !packagePatches.includes(selector)) {
      problems.push(
        `allowBuilds ${selector} does not match patched dependency ${packagePatches.join(", ")}`,
      );
    }
  }

  return problems;
}

function normalizeOverrideVersion(value) {
  return value.replace(/^npm:[^@]+@/, "");
}

function parseDocumentedOverridePins(sectionText) {
  const version = "((?:\\^|~|>=|<=|>|<|=|npm:|v?\\d)[^`]*)";
  const toForm = new RegExp(`\`([^\`]+)\`(?:\\s+pinned)?\\s+to\\s+\`${version}\``, "g");
  const parenForm = new RegExp(`\`([^\`]+)\`\\s+(?:alias\\s+)?\\(\`${version}\``, "g");

  const pins = [];
  for (const match of sectionText.matchAll(toForm)) {
    pins.push({ name: match[1], version: match[2] });
  }
  for (const match of sectionText.matchAll(parenForm)) {
    pins.push({ name: match[1], version: match[2] });
  }
  return pins;
}

export function checkDependencyOverridesDocumented(context) {
  const pkg = readJsonInRoot(context, "package.json");
  if (pkg.pnpm?.overrides || pkg.overrides) {
    return invariantResult(
      "dependency overrides match governance doc",
      false,
      "pnpm 11 requires overrides only in pnpm-workspace.yaml",
    );
  }

  const overrides = getRootOverrides(context);
  const overrideNames = Object.keys(overrides);
  if (overrideNames.length === 0) {
    return invariantResult("dependency overrides match governance doc", true);
  }

  const section = readDependencyGovernanceSection(context);
  if (!section) {
    return invariantResult(
      "dependency overrides match governance doc",
      false,
      "PACKAGE_GOVERNANCE.md Dependency Governance section missing",
    );
  }

  const normalized = new Map(
    overrideNames.map((name) => [name, normalizeOverrideVersion(overrides[name])]),
  );
  const problems = [];

  for (const [name, value] of normalized) {
    if (!section.includes(`\`${name}\``)) {
      problems.push(`override ${name} not documented`);
      continue;
    }
    if (!section.includes(`\`${value}\``)) {
      problems.push(`override ${name} version ${value} not documented`);
    }
  }

  for (const pin of parseDocumentedOverridePins(section)) {
    if (!normalized.has(pin.name)) {
      problems.push(`documented pin ${pin.name} has no root override`);
      continue;
    }
    if (normalized.get(pin.name) !== pin.version) {
      problems.push(
        `documented pin ${pin.name} ${pin.version} != override ${normalized.get(pin.name)}`,
      );
    }
  }

  return invariantResult(
    "dependency overrides match governance doc",
    problems.length === 0,
    problems.slice(0, 10).join("; "),
  );
}

// `allowBuilds` decides which dependencies may execute install scripts, so the governance doc has to
// name every entry verbatim — an approval the doc does not list is an unreviewed one.
export function checkAllowBuildsDocumented(context) {
  const name = "allowBuilds entries match governance doc";
  const workspace = readRootWorkspace(context);
  const entries = Object.keys(workspace?.allowBuilds ?? {});
  if (entries.length === 0) {
    return invariantResult(name, true);
  }

  const section = readDependencyGovernanceSection(context);
  if (!section) {
    return invariantResult(
      name,
      false,
      "PACKAGE_GOVERNANCE.md Dependency Governance section missing",
    );
  }

  const problems = entries
    .filter((entry) => !section.includes(`\`${entry}\``))
    .map((entry) => `allowBuilds ${entry} not documented`);
  problems.push(...collectPositiveAllowBuildsProblems(context, workspace));

  return invariantResult(name, problems.length === 0, problems.slice(0, 10).join("; "));
}

export function checkLicensedPackagesInGovernanceSplit(context) {
  if (!existsInRoot(context, "PACKAGE_GOVERNANCE.md")) {
    return invariantResult("licensed packages appear in governance split", true);
  }

  const section = sliceDocSection(readTextInRoot(context, "PACKAGE_GOVERNANCE.md"), "Licensing");
  if (!section) {
    return invariantResult(
      "licensed packages appear in governance split",
      false,
      "Licensing section missing",
    );
  }

  const lines = section.split("\n");
  const bulletFor = (marker) => lines.find((line) => line.includes(marker)) ?? "";
  const missing = [];

  for (const [file, parsed] of context.parsedPackages) {
    if (!/^(apps|cli|libs)\/[^/]+\/package\.json$/.test(file)) continue;

    const marker = LICENSE_MARKERS[parsed.license] ? `**${parsed.license}**` : null;
    if (!marker) continue;

    const dir = file.replace(/\/package\.json$/, "");
    if (!bulletFor(marker).includes(dir)) {
      missing.push(`${dir} (${parsed.license})`);
    }
  }

  return invariantResult(
    "licensed packages appear in governance split",
    missing.length === 0,
    missing.slice(0, 10).join(", "),
  );
}
