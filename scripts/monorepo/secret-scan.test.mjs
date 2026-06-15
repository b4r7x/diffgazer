import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { collectSecretFindings, formatSecretFindings } from "./secret-scan.mjs";

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
