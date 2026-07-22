import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  collectReleaseGuardFailures,
  collectReleaseRecoveryFailures,
  REQUIRED_RELEASE_GUARDS,
} from "./release.mjs";
import { PACKAGE_GOVERNANCE_PATH, RELEASE_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed release workflow carries every provenance guard", () => {
  assert.deepEqual(collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")), []);
});

test("the committed release recovery is hosted, merged-main-only, and OIDC protected", () => {
  assert.deepEqual(
    collectReleaseRecoveryFailures(
      readFileSync(RELEASE_WORKFLOW_PATH, "utf8"),
      readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8"),
    ),
    [],
  );
});

test("release recovery rejects loss of each security boundary", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const governance = readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8");
  const replaceLast = (source, search, replacement) => {
    const index = source.lastIndexOf(search);
    assert.notEqual(index, -1);
    return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
  };
  const weakened = [
    workflow.replace("environment: production", "environment: staging"),
    workflow.replace("git merge-base --is-ancestor", "git merge-base"),
    workflow.replace("^[0-9a-fA-F]{40}$", "^.+$"),
    workflow.replace("ref: ${{ inputs.release_sha }}", "ref: main"),
    replaceLast(workflow, "id-token: write", "id-token: none"),
  ];

  for (const source of weakened) {
    assert.notDeepEqual(collectReleaseRecoveryFailures(source, governance), []);
  }
});

test("release governance rejects the former local provenance fallback", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const governance = readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8").replace(
    "## Dependency Management",
    "NPM_CONFIG_PROVENANCE=true\n\n## Dependency Management",
  );

  assert.ok(
    collectReleaseRecoveryFailures(workflow, governance).includes(
      `${PACKAGE_GOVERNANCE_PATH}: recovery must not prescribe local provenance publish`,
    ),
  );
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
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_repository.full_name == github.repository`,
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

test("the successful workflow conclusion is mandatory", () => {
  const source = [
    "jobs:",
    "  release:",
    "    if: >-",
    "      ${{ github.event.workflow_run.event == 'push'",
    "      && github.event.workflow_run.head_repository.full_name == github.repository",
    "      && github.event.workflow_run.head_branch == 'main' }}",
  ].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.conclusion == 'success'`,
  ]);
});

test("an OR escape hatch cannot weaken the required conjunction", () => {
  const guard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& github.event.workflow_run.head_repository.full_name == github.repository",
    "&& github.event.workflow_run.head_branch == 'main'",
    "|| true }}",
  ].join(" ");
  const source = ["jobs:", "  release:", `    if: "${guard}"`].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` must use only a positive \`&&\` conjunction`,
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_branch == 'main'`,
  ]);
});

test("a negated required predicate is not accepted by substring", () => {
  const guard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& !(github.event.workflow_run.head_repository.full_name == github.repository)",
    "&& github.event.workflow_run.head_branch == 'main' }}",
  ].join(" ");
  const source = ["jobs:", "  release:", `    if: "${guard}"`].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_repository.full_name == github.repository`,
  ]);
});
