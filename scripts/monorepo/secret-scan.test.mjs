import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { collectSecretFindings, formatSecretFindings, MAX_FILE_BYTES } from "./secret-scan.mjs";

function scanSource(source) {
  const dir = mkdtempSync(join(tmpdir(), "dg-secret-scan-"));
  const path = join(dir, "fixture.txt");

  try {
    writeFileSync(path, source);
    return collectSecretFindings([path]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("secret scan detects high-confidence token shapes without printing the token", () => {
  const fakeToken = `ghp_${"A".repeat(36)}`;
  const findings = scanSource(`GITHUB_TOKEN="${fakeToken}"\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].pattern, "github-token");
  assert.match(formatSecretFindings(findings)[0], /<redacted:/);
  assert.doesNotMatch(formatSecretFindings(findings)[0], new RegExp(fakeToken));
});

test("secret scan detects and redacts recognized tokens beyond the in-memory cap", () => {
  const fakeToken = `ghp_${"Z".repeat(36)}`;
  const prefix = "x".repeat(64 * 1024 - 10);
  const findings = scanSource(`${prefix} ${fakeToken}\n${"y".repeat(MAX_FILE_BYTES)}`);
  const formatted = formatSecretFindings(findings).join("\n");

  assert.equal(
    findings.some((finding) => finding.pattern === "github-token"),
    true,
  );
  assert.match(formatted, /<redacted:/);
  assert.doesNotMatch(formatted, new RegExp(fakeToken));
});

test("secret scan retains oversized binary and ignored-path exclusions", () => {
  const dir = mkdtempSync(join(tmpdir(), "dg-secret-exclusions-"));
  const binaryPath = join(dir, "fixture.bin");
  const ignoredPath = join(dir, ".nuke", "fixture.txt");
  const fakeToken = `ghp_${"Q".repeat(36)}`;
  const cwd = process.cwd();

  try {
    writeFileSync(binaryPath, `${"a".repeat(MAX_FILE_BYTES)}\0${fakeToken}`);
    mkdirSync(dirname(ignoredPath), { recursive: true });
    writeFileSync(ignoredPath, fakeToken);
    process.chdir(dir);

    assert.deepEqual(collectSecretFindings([binaryPath, ".nuke/fixture.txt"]), []);
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("secret scan redacts every recognized secret before formatting any finding on the line", () => {
  const githubToken = `ghp_${"A".repeat(36)}`;
  const openRouterKey = `sk-or-v1-${"B".repeat(32)}`;
  const findings = scanSource(
    `prefix ${githubToken} middle ${openRouterKey} repeated ${githubToken} suffix\n`,
  );
  const formatted = formatSecretFindings(findings).join("\n");

  assert.equal(findings.length, 3);
  assert.doesNotMatch(formatted, new RegExp(githubToken));
  assert.doesNotMatch(formatted, new RegExp(openRouterKey));
  assert.match(formatted, /prefix/);
  assert.match(formatted, /middle/);
  assert.match(formatted, /repeated/);
  assert.match(formatted, /suffix/);
});

test("secret scan detects fine-grained GitHub tokens", () => {
  const fakeToken = `github_pat_${"A".repeat(82)}`;
  const findings = scanSource(`${fakeToken}\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].pattern, "github-fine-grained-token");
});

test("secret scan detects unquoted provider keys", () => {
  const fakeKey = `AIza${"A".repeat(35)}`;
  const findings = scanSource(`GOOGLE_API_KEY=${fakeKey}\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].pattern, "google-api-key");
});

test("secret scan ignores obvious placeholder values", () => {
  const findings = scanSource('OPENAI_API_KEY="sk-proj-xxxxx"\n');

  assert.deepEqual(findings, []);
});

test("secret scan detects generic high-entropy secret assignments", () => {
  const value = "abc123ABC._-+=".repeat(4);
  const findings = scanSource(`COOLIFY_SECRET=${value}\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].pattern, "generic-secret-assignment");
});

test("secret scan includes committed public registry contracts", () => {
  const dir = mkdtempSync(join(tmpdir(), "dg-secret-public-r-"));
  const relPath = "libs/ui/public/r/planted.json";
  const filePath = join(dir, relPath);
  const fakeToken = `ghp_${"B".repeat(36)}`;
  const cwd = process.cwd();

  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `{"token":"${fakeToken}"}\n`);
    process.chdir(dir);

    const findings = collectSecretFindings([relPath]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, relPath);
    assert.equal(findings[0].pattern, "github-token");
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
