import assert from "node:assert/strict";
import { test } from "node:test";
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
