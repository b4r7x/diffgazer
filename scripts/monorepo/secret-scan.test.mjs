import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { escapeRegExp } from "./lib/regexp.mjs";
import { collectSecretFindings, formatSecretFindings } from "./secret-scan.mjs";

const LARGE_FILE_BYTES = 2 * 1024 * 1024;

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

test("secret scan detects and redacts recognized tokens in a large file", () => {
  const fakeToken = `ghp_${"Z".repeat(36)}`;
  const prefix = "x".repeat(64 * 1024 - 10);
  const findings = scanSource(`${prefix} ${fakeToken}\n${"y".repeat(LARGE_FILE_BYTES)}`);
  const formatted = formatSecretFindings(findings).join("\n");

  assert.equal(
    findings.some((finding) => finding.pattern === "github-token"),
    true,
  );
  assert.match(formatted, /<redacted:/);
  assert.doesNotMatch(formatted, new RegExp(fakeToken));
});

test("secret scan skips a small binary file even when it embeds a recognized token", () => {
  const dir = mkdtempSync(join(tmpdir(), "dg-secret-scan-small-binary-"));
  const binaryPath = join(dir, "fixture.bin");
  const fakeToken = `ghp_${"S".repeat(36)}`;

  try {
    writeFileSync(binaryPath, `prefix\0${fakeToken}`);

    assert.deepEqual(collectSecretFindings([binaryPath]), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("secret scan skips an oversized binary file even when it embeds a recognized token", () => {
  const dir = mkdtempSync(join(tmpdir(), "dg-secret-exclusions-"));
  const binaryPath = join(dir, "fixture.bin");
  const fakeToken = `ghp_${"Q".repeat(36)}`;

  try {
    writeFileSync(binaryPath, `${"a".repeat(LARGE_FILE_BYTES)}\0${fakeToken}`);

    assert.deepEqual(collectSecretFindings([binaryPath]), []);
  } finally {
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

test("secret scan reports a blank-line-preceded assignment on its own line", () => {
  const value = "abc123ABC._-+=".repeat(4);
  const findings = scanSource(`# header\n\n\nCOOLIFY_SECRET=${value}\nTRAILER=ok\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].pattern, "generic-secret-assignment");
  assert.equal(findings[0].line, 4);
  assert.doesNotMatch(formatSecretFindings(findings)[0], new RegExp(escapeRegExp(value)));
});

test("secret scan redacts a generic assignment sharing a line with another secret", () => {
  const value = "aZ9-kQ2_wX7mB4nR6tY1uI8oP3sD5fG0hJcV";
  const githubToken = `ghp_${"A".repeat(36)}`;
  const findings = scanSource(`# header\n\nAPI_KEY=${value} ${githubToken}\n`);
  const formatted = formatSecretFindings(findings).join("\n");

  assert.equal(findings.length, 2);
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(value)));
  assert.doesNotMatch(formatted, new RegExp(githubToken));
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

test("secret scan CLI entry fails closed on a tracked secret without printing the raw token", () => {
  const root = mkdtempSync(join(tmpdir(), "dg-secret-scan-worktree-"));
  const fakeToken = `ghp_${"W".repeat(36)}`;
  const ignoredToken = `ghp_${"I".repeat(36)}`;

  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    writeFileSync(join(root, "fixture.txt"), `GITHUB_TOKEN="${fakeToken}"\n`);
    execFileSync("git", ["add", "fixture.txt"], { cwd: root });
    // Gitignored trees are out of scope because git never lists them, not
    // because the scanner carries its own exclusion table.
    writeFileSync(join(root, ".gitignore"), "vendor/\n");
    mkdirSync(join(root, "vendor"), { recursive: true });
    writeFileSync(join(root, "vendor", "creds.txt"), `GITHUB_TOKEN="${ignoredToken}"\n`);

    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./secret-scan.mjs", import.meta.url))],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(child.status, 1);
    assert.match(child.stderr, /Secret scan failed\./);
    assert.match(child.stderr, /fixture\.txt:1 github-token/);
    assert.match(child.stderr, /<redacted:/);
    assert.doesNotMatch(child.stderr, /vendor\/creds\.txt/);
    assert.doesNotMatch(`${child.stdout}${child.stderr}`, new RegExp(fakeToken));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
