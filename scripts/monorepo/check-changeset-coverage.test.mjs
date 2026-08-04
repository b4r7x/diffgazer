import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  checkChangesetCoverage,
  collectChangesetCoverageFailures,
} from "./check-changeset-coverage.mjs";
import { RELEASE_READINESS_WORKFLOW_PATH } from "./check-release-workflow-guards/workflow-source.mjs";

const COVERAGE_SCRIPT = "check:changesets";
const COVERAGE_COMMAND = `pnpm run ${COVERAGE_SCRIPT}`;

const UI_CHANGESET = ["---", '"@diffgazer/ui": minor', "---", "", "Menu gained j/k.", ""].join(
  "\n",
);
const BOTH_CHANGESET = [
  "---",
  '"@diffgazer/ui": minor',
  '"@diffgazer/keys": minor',
  "---",
  "",
  "Vim aliases across both packages.",
  "",
].join("\n");

function collect(changedPaths, changesets = {}) {
  return collectChangesetCoverageFailures({
    changedPaths,
    readChangeset: (path) => changesets[path] ?? "",
  });
}

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// A repo whose only changeset is already committed on the base branch — the
// shape `changeset status --since=origin/main` cannot distinguish from coverage.
function createRepoWithCommittedChangeset() {
  const root = mkdtempSync(join(tmpdir(), "dg-changeset-coverage-"));
  tempRoots.push(root);

  execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" });
  writeText(root, ".changeset/config.json", JSON.stringify({ baseBranch: "main" }));
  writeText(root, ".changeset/earlier-campaign.md", BOTH_CHANGESET);
  writeText(root, "libs/ui/public/r/menu.json", '{"name":"menu"}\n');
  writeText(root, "libs/keys/public/r/navigation.json", '{"name":"navigation"}\n');
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "seed"], {
    cwd: root,
    stdio: "ignore",
  });

  return root;
}

test("a changed public registry file needs a changeset declaring its package", () => {
  assert.deepEqual(collect(["libs/ui/public/r/menu.json"]), [
    '1 file(s) under libs/ui/public/r/ changed (e.g. libs/ui/public/r/menu.json) but no changeset in this change set declares "@diffgazer/ui"',
  ]);
});

test("a changeset in the same change set covers its package", () => {
  assert.deepEqual(
    collect(["libs/ui/public/r/menu.json", ".changeset/vim.md"], {
      ".changeset/vim.md": UI_CHANGESET,
    }),
    [],
  );
});

test("each guarded package needs its own declaration", () => {
  const failures = collect(
    ["libs/ui/public/r/menu.json", "libs/keys/public/r/navigation.json", ".changeset/vim.md"],
    { ".changeset/vim.md": UI_CHANGESET },
  );

  assert.equal(failures.length, 1);
  assert.match(failures[0], /libs\/keys\/public\/r\/.+"@diffgazer\/keys"/);
});

test("changes outside the guarded trees need no changeset", () => {
  assert.deepEqual(collect(["libs/ui/registry/ui/menu/menu.tsx", "apps/web/src/main.tsx"]), []);
});

test("a none bump declares no release note", () => {
  const noneChangeset = ["---", '"@diffgazer/ui": none', "---", "", "No release.", ""].join("\n");

  assert.equal(
    collect(["libs/ui/public/r/menu.json", ".changeset/none.md"], {
      ".changeset/none.md": noneChangeset,
    }).length,
    1,
  );
});

test("a changeset deleted by `changeset version` covers nothing", () => {
  assert.equal(collect(["libs/ui/public/r/menu.json", ".changeset/consumed.md"]).length, 1);
});

test("a changeset committed on the base branch does not cover a later registry change", () => {
  const root = createRepoWithCommittedChangeset();
  writeText(root, "libs/ui/public/r/menu.json", '{"name":"menu","updated":true}\n');

  const failures = checkChangesetCoverage(root);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /libs\/ui\/public\/r\/.+"@diffgazer\/ui"/);
});

test("an uncommitted changeset added beside the registry change covers it", () => {
  const root = createRepoWithCommittedChangeset();
  writeText(root, "libs/ui/public/r/menu.json", '{"name":"menu","updated":true}\n');
  writeText(root, ".changeset/this-campaign.md", UI_CHANGESET);

  assert.deepEqual(checkChangesetCoverage(root), []);
});

test("a deleted public registry item still needs a changeset", () => {
  const root = createRepoWithCommittedChangeset();
  rmSync(join(root, "libs/keys/public/r/navigation.json"));

  const failures = checkChangesetCoverage(root);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /libs\/keys\/public\/r\/.+"@diffgazer\/keys"/);
});

test("release readiness runs the changeset coverage gate in its verify job", () => {
  const workflow = parse(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8"));
  const verifyCommands = workflow.jobs.verify.steps.map((step) => step?.run);

  assert.ok(
    verifyCommands.includes(COVERAGE_COMMAND),
    `CI verify job missing changeset coverage step: ${COVERAGE_COMMAND}`,
  );
});

test("the coverage script runs this checker", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
  );

  assert.equal(
    rootPackageJson.scripts[COVERAGE_SCRIPT],
    "node scripts/monorepo/check-changeset-coverage.mjs",
  );
});
