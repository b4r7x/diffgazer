#!/usr/bin/env node

import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import { listRepoFiles } from "./lib/files.mjs";
import { runValidationChecks } from "./lib/run-checks.mjs";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SCAN_CHUNK_BYTES = 64 * 1024;
const SCAN_OVERLAP_CHARS = 1024;

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
    regex: /\bsk-(?!or-v1-)(?:proj|live|test)?-?[A-Za-z0-9_-]{32,}\b/g,
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

function mergeSpans(spans) {
  const merged = [];
  for (const span of spans.sort((a, b) => a.start - b.start || a.end - b.end)) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
      continue;
    }
    merged.push({ ...span });
  }
  return merged;
}

function redactLine(line, spans) {
  let redacted = "";
  let cursor = 0;
  for (const span of mergeSpans(spans)) {
    redacted += line.slice(cursor, span.start);
    redacted += `<redacted:${span.end - span.start}>`;
    cursor = span.end;
  }
  return redacted + line.slice(cursor);
}

function collectSourceMatches(path, source) {
  const matches = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of source.matchAll(pattern.regex)) {
      const value = pattern.valueGroup ? match[pattern.valueGroup] : match[0];
      if (!value || isPlaceholder(value)) continue;
      if (pattern.valueGroup && shannonEntropy(value) < 3) continue;

      const start = match.index ?? 0;
      const lineNumber = getLineNumber(source, start);
      const lineStart = source.lastIndexOf("\n", start - 1) + 1;
      matches.push({
        path,
        line: lineNumber,
        pattern: pattern.name,
        start,
        end: start + match[0].length,
        lineStart,
      });
    }
  }

  return matches;
}

function collectFileFindings(path, source) {
  if (source.includes("\0")) return [];
  const matches = collectSourceMatches(path, source);
  const lines = source.split("\n");
  const spansByLine = new Map();
  for (const match of matches) {
    const spans = spansByLine.get(match.line) ?? [];
    spans.push({ start: match.start - match.lineStart, end: match.end - match.lineStart });
    spansByLine.set(match.line, spans);
  }

  return matches.map((match) => ({
    path: match.path,
    line: match.line,
    pattern: match.pattern,
    preview: redactLine(lines[match.line - 1] ?? "", spansByLine.get(match.line) ?? []),
  }));
}

function countNewlines(source) {
  let count = 0;
  for (const char of source) {
    if (char === "\n") count += 1;
  }
  return count;
}

function collectOversizedFileFindings(path) {
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(SCAN_CHUNK_BYTES);
  const decoder = new StringDecoder("utf8");
  const findings = new Map();
  let overlap = "";
  let decodedChars = 0;
  let decodedNewlines = 0;
  let isBinary = false;

  const scanChunk = (text) => {
    if (!text) return;
    const previousOverlapLength = overlap.length;
    const combined = overlap + text;
    const combinedStart = decodedChars - previousOverlapLength;
    const combinedStartLine = 1 + decodedNewlines - countNewlines(overlap);

    for (const match of collectSourceMatches(path, combined)) {
      if (match.end <= previousOverlapLength) continue;
      const absoluteStart = combinedStart + match.start;
      findings.set(`${match.pattern}:${absoluteStart}`, {
        path,
        line: combinedStartLine + match.line - 1,
        pattern: match.pattern,
        preview: `<redacted:${match.end - match.start}>`,
      });
    }

    decodedChars += text.length;
    decodedNewlines += countNewlines(text);
    overlap = combined.slice(-SCAN_OVERLAP_CHARS);
  };

  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      if (chunk.includes(0)) {
        isBinary = true;
        break;
      }
      scanChunk(decoder.write(chunk));
    }
    if (!isBinary) scanChunk(decoder.end());
  } finally {
    closeSync(descriptor);
  }

  return isBinary ? [] : [...findings.values()];
}

export function collectSecretFindings(files) {
  const findings = [];

  for (const path of files) {
    if (shouldSkipFile(path) || !existsSync(path)) continue;
    const stats = statSync(path);
    if (!stats.isFile()) continue;

    if (stats.size > MAX_FILE_BYTES) {
      findings.push(...collectOversizedFileFindings(path));
    } else {
      findings.push(...collectFileFindings(path, readFileSync(path, "utf8")));
    }
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
  runValidationChecks(formatSecretFindings(findings), {
    failureHeader:
      "Secret scan failed. Remove the suspected secret or add a narrow scanner exception with reviewer approval.",
    successMessage: "OK: secret scan completed with no high-confidence findings",
  });
}
