#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listRepoFiles } from "./lib/files.mjs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SKIPPED_PREFIXES = [
  ".git/",
  ".nuke/",
  ".audit-runs/",
  ".worktrees/",
  "node_modules/",
  "cli/add/src/generated/",
];

const SECRET_PATTERNS = [
  {
    name: "private-key",
    regex: /-----BEGIN (?:(?:RSA|DSA|EC|OPENSSH|PGP) )?PRIVATE KEY-----/g,
  },
  {
    name: "github-token",
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g,
  },
  {
    name: "github-fine-grained-token",
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g,
  },
  {
    name: "npm-token",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: "google-api-key",
    regex: /\bAIza[A-Za-z0-9_-]{35}\b/g,
  },
  {
    name: "openrouter-key",
    regex: /\bsk-or-v1-[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: "groq-key",
    regex: /\bgsk_[A-Za-z0-9]{32,}\b/g,
  },
  {
    name: "openai-key",
    regex: /\bsk-(?:proj|live|test)?-?[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: "aws-access-key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "slack-token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    name: "generic-secret-assignment",
    regex:
      /^\s*(?:export\s+)?[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*["']?([^"'\s#]{32,})["']?/gm,
    valueGroup: 1,
  },
];

function shouldSkipFile(path) {
  return SKIPPED_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("example") ||
    normalized.includes("placeholder") ||
    normalized.includes("replace-me") ||
    normalized.includes("your-") ||
    /^x+$/.test(normalized)
  );
}

function shannonEntropy(value) {
  const counts = new Map();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function getLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function redactLine(line, matchText) {
  return line.replace(matchText, `<redacted:${matchText.length}>`);
}

function collectFileFindings(path, source) {
  const findings = [];
  const lines = source.split("\n");

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of source.matchAll(pattern.regex)) {
      const value = pattern.valueGroup ? match[pattern.valueGroup] : match[0];
      if (!value || isPlaceholder(value)) continue;
      if (pattern.valueGroup && shannonEntropy(value) < 3) continue;

      const lineNumber = getLineNumber(source, match.index ?? 0);
      findings.push({
        path,
        line: lineNumber,
        pattern: pattern.name,
        preview: redactLine(lines[lineNumber - 1] ?? "", match[0]),
      });
    }
  }

  return findings;
}

export function collectSecretFindings(files, readFile = readFileSync) {
  const findings = [];

  for (const path of files) {
    if (shouldSkipFile(path) || !existsSync(path)) continue;
    const stats = statSync(path);
    if (!stats.isFile() || stats.size > MAX_FILE_BYTES) continue;

    const source = readFile(path, "utf8");
    findings.push(...collectFileFindings(path, source));
  }

  return findings;
}

export function formatSecretFindings(findings) {
  return findings.map(
    (finding) => `${finding.path}:${finding.line} ${finding.pattern} ${finding.preview}`,
  );
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const findings = collectSecretFindings(listRepoFiles());

  if (findings.length > 0) {
    console.error(
      "Secret scan failed. Remove the suspected secret or add a narrow scanner exception with reviewer approval.",
    );
    for (const line of formatSecretFindings(findings)) {
      console.error(line);
    }
    process.exit(1);
  }

  console.log("OK: secret scan completed with no high-confidence findings");
}
