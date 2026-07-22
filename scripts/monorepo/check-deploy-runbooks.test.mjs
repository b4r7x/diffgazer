import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectDeployRunbookFailures,
  collectRunbookStyleFailures,
  DEPLOY_RUNBOOK_PATHS,
} from "./check-deploy-runbooks.mjs";

test("deploy runbook check covers the public deployment and reverse proxy runbooks", () => {
  assert.deepEqual(DEPLOY_RUNBOOK_PATHS, [
    "deploy/PUBLIC_DEPLOYMENT.md",
    "deploy/REVERSE_PROXY.md",
  ]);
});

test("runbook style check accepts clean markdown", () => {
  assert.deepEqual(
    collectRunbookStyleFailures("deploy/PUBLIC_DEPLOYMENT.md", "# Title\n\nText\n"),
    [],
  );
});

test("runbook style check rejects trailing whitespace and conflict markers", () => {
  assert.deepEqual(
    collectRunbookStyleFailures(
      "deploy/REVERSE_PROXY.md",
      ["# Title  ", "<<<<<<< ours", "content", "=======", ">>>>>>> theirs"].join("\n"),
    ),
    [
      "deploy/REVERSE_PROXY.md:1: trailing whitespace",
      "deploy/REVERSE_PROXY.md:2: conflict marker",
      "deploy/REVERSE_PROXY.md:4: conflict marker",
      "deploy/REVERSE_PROXY.md:5: conflict marker",
    ],
  );
});

test("deploy runbook check reads every configured runbook", () => {
  const seen = [];
  const failures = collectDeployRunbookFailures(["a.md", "b.md"], (path) => {
    seen.push(path);
    return path === "a.md" ? "ok\n" : "bad \n";
  });

  assert.deepEqual(seen, ["a.md", "b.md"]);
  assert.deepEqual(failures, ["b.md:1: trailing whitespace"]);
});

test("deploy runbook CLI entry fails closed with a path-specific diagnostic", () => {
  const root = mkdtempSync(join(tmpdir(), "dg-deploy-runbooks-"));

  try {
    for (const path of DEPLOY_RUNBOOK_PATHS) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "# Title\n\nText\n");
    }
    writeFileSync(join(root, DEPLOY_RUNBOOK_PATHS[1]), "# Title  \n\nText\n");

    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./check-deploy-runbooks.mjs", import.meta.url))],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(child.status, 1);
    assert.match(child.stderr, /Deploy runbook style checks failed/);
    assert.match(child.stderr, new RegExp(`${DEPLOY_RUNBOOK_PATHS[1]}:1: trailing whitespace`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
