import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  collectReleaseGuardFailures,
  RELEASE_WORKFLOW_PATH,
  REQUIRED_RELEASE_GUARDS,
} from "./check-release-workflow-guards.mjs";

test("the committed release workflow carries every provenance guard", () => {
  assert.deepEqual(collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")), []);
});

test("dropping a guard from the release job if is reported", () => {
  const workflow = [
    "jobs:",
    "  release:",
    "    if: >-",
    "      ${{ github.event.workflow_run.conclusion == 'success'",
    "      && github.event.workflow_run.event == 'push'",
    "      && github.event.workflow_run.head_branch == 'main' }}",
  ].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(workflow), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: head_repository.full_name == github.repository`,
  ]);
});

test("a release job with no if guard fails", () => {
  const workflow = ["jobs:", "  release:", "    runs-on: ubuntu-latest"].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(workflow), [
    `${RELEASE_WORKFLOW_PATH}: release job is missing an \`if\` guard`,
  ]);
});

test("each required guard is enforced independently", () => {
  const fullGuard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& github.event.workflow_run.head_repository.full_name == github.repository",
    "&& github.event.workflow_run.head_branch == 'main' }}",
  ].join(" ");

  for (const guard of REQUIRED_RELEASE_GUARDS) {
    const weakened = fullGuard.replace(guard, "true");
    const source = ["jobs:", "  release:", `    if: "${weakened}"`].join("\n");

    assert.deepEqual(collectReleaseGuardFailures(source), [
      `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: ${guard}`,
    ]);
  }
});
