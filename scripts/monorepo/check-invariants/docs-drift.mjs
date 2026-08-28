import { existsInRoot, invariantResult, parseLines, readTextInRoot } from "./context.mjs";
import { PUBLISHABLE_PACKAGE_FILES } from "./packages.mjs";

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
