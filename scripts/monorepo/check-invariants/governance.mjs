import { parse as parseYaml } from "yaml";
import {
  existsInRoot,
  invariantResult,
  parseLines,
  readJsonInRoot,
  readTextInRoot,
} from "./context.mjs";
import { LICENSE_MARKERS, PUBLISHABLE_PACKAGE_FILES } from "./packages.mjs";

function sliceDocSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const after = text.slice(start + marker.length);
  const next = after.search(/\n## /);
  return next === -1 ? after : after.slice(0, next);
}

function extractReportingChannels(text) {
  const channels = new Set();
  const advisoryUrl = /https:\/\/github\.com\/[^\s)]+\/security\/advisories\/new/gi;
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const match of text.matchAll(advisoryUrl)) channels.add(match[0].toLowerCase());
  for (const match of text.matchAll(email)) channels.add(match[0].toLowerCase());
  return channels;
}

function compareReportingChannels(label, channels, rootChannels, violations, requireEvery) {
  for (const channel of channels) {
    if (!rootChannels.has(channel)) {
      violations.push(`${label}: unexpected ${channel}`);
    }
  }
  if (!requireEvery) return;
  for (const channel of rootChannels) {
    if (!channels.has(channel)) {
      violations.push(`${label}: missing ${channel}`);
    }
  }
}

function collectReportingChannelDrift(context, docPath, rootChannels, violations, requireEvery) {
  if (!existsInRoot(context, docPath)) return;

  const channels = extractReportingChannels(readTextInRoot(context, docPath));
  compareReportingChannels(docPath, channels, rootChannels, violations, requireEvery);
}

function extractReadmeSecurityMetadata(text) {
  const match = text.match(/^\s*[-*]\s*\*\*Security:\*\*\s*(.+)$/im);
  return match ? match[1] : null;
}

function collectReadmeSecurityChannelDrift(context, readmePath, rootChannels, violations) {
  if (!existsInRoot(context, readmePath)) return;

  const securityLine = extractReadmeSecurityMetadata(readTextInRoot(context, readmePath));
  if (securityLine == null) return;

  const channels = extractReportingChannels(securityLine);
  compareReportingChannels(`${readmePath} Security`, channels, rootChannels, violations, true);
}

const DOCUMENTED_ENV_KEY = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm;

export function documentedEnvKeys(source) {
  return new Set(
    [...source.matchAll(DOCUMENTED_ENV_KEY)].flatMap((match) => (match[1] ? [match[1]] : [])),
  );
}

function documentedEnvKeysInRoot(context, path) {
  return documentedEnvKeys(readTextInRoot(context, path));
}

function trackedSurfaceEnvExamplePaths(context) {
  return parseLines(context.commandOutputs.gitLsFilesEnvExamples).filter(
    (path) => path && path !== ".env.example",
  );
}

export function checkSurfaceEnvExampleKeysStayInRootExample(context) {
  const name = "surface env.example keys stay in root .env.example";

  if (!existsInRoot(context, ".env.example")) {
    return invariantResult(name, false, ".env.example missing");
  }

  const canonicalKeys = documentedEnvKeysInRoot(context, ".env.example");
  const surfaceExamples = trackedSurfaceEnvExamplePaths(context);

  if (surfaceExamples.length === 0) {
    return invariantResult(name, false, "no tracked surface *env.example files");
  }

  const violations = [];
  for (const path of surfaceExamples) {
    if (!existsInRoot(context, path)) {
      violations.push(`${path} missing on disk`);
      continue;
    }
    const missing = [...documentedEnvKeysInRoot(context, path)].filter(
      (key) => !canonicalKeys.has(key),
    );
    if (missing.length > 0) {
      violations.push(`${path}: ${missing.join(", ")}`);
    }
  }

  return invariantResult(name, violations.length === 0, violations.slice(0, 10).join("; "));
}

export function checkSecurityReportingChannelsAgree(context) {
  const rootChannels = extractReportingChannels(readTextInRoot(context, "SECURITY.md"));
  const violations = [];

  collectReportingChannelDrift(context, "SUPPORT.md", rootChannels, violations, false);
  for (const pkgFile of PUBLISHABLE_PACKAGE_FILES) {
    const securityPath = pkgFile.replace(/package\.json$/, "SECURITY.md");
    collectReportingChannelDrift(context, securityPath, rootChannels, violations, true);
    const supportPath = pkgFile.replace(/package\.json$/, "SUPPORT.md");
    collectReportingChannelDrift(context, supportPath, rootChannels, violations, false);
    const readmePath = pkgFile.replace(/package\.json$/, "README.md");
    collectReadmeSecurityChannelDrift(context, readmePath, rootChannels, violations);
  }

  return invariantResult(
    "security and support reporting channels match root policy",
    violations.length === 0,
    violations.slice(0, 10).join("; "),
  );
}

function getRootOverrides(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  return workspace?.overrides ?? {};
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

  const section = existsInRoot(context, "PACKAGE_GOVERNANCE.md")
    ? sliceDocSection(readTextInRoot(context, "PACKAGE_GOVERNANCE.md"), "Dependency Governance")
    : null;
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
