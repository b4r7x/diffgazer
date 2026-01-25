import { createHash } from "node:crypto";
import type { TriageIssue, TriageSeverity } from "@repo/schemas";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "be",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "at",
  "for",
]);

const SEVERITY_RANK: Record<TriageSeverity, number> = {
  blocker: 4,
  high: 3,
  medium: 2,
  low: 1,
  nit: 0,
};

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => !STOP_WORDS.has(word))
    .join(" ")
    .trim();
}

export function getHunkDigest(diffHunk: string): string {
  const normalized = diffHunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return createHash("sha1").update(normalized).digest("hex");
}

export function generateFingerprint(issue: TriageIssue, diffHunk?: string): string {
  const parts = [
    issue.file,
    issue.category,
    normalizeTitle(issue.title),
  ];

  if (diffHunk) {
    parts.push(getHunkDigest(diffHunk));
  }

  const content = parts.join("|");
  return createHash("sha256").update(content).digest("hex");
}

export function mergeIssues(issues: TriageIssue[]): TriageIssue[] {
  const byFingerprint = new Map<string, TriageIssue>();

  for (const issue of issues) {
    const fingerprint = generateFingerprint(issue);
    const existing = byFingerprint.get(fingerprint);

    if (!existing) {
      byFingerprint.set(fingerprint, issue);
      continue;
    }

    const existingRank = SEVERITY_RANK[existing.severity];
    const issueRank = SEVERITY_RANK[issue.severity];

    if (issueRank > existingRank) {
      byFingerprint.set(fingerprint, issue);
    } else if (issueRank === existingRank && issue.confidence > existing.confidence) {
      byFingerprint.set(fingerprint, issue);
    }
  }

  return Array.from(byFingerprint.values());
}
