import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RECOVERY_READINESS_GATE_STEP } from "./readiness.mjs";
import {
  collectReleaseChangesetsFailures,
  collectReleaseGuardFailures,
  collectReleaseRecoveryFailures,
  REQUIRED_RELEASE_GUARDS,
} from "./release.mjs";
import { PACKAGE_GOVERNANCE_PATH, RELEASE_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed release workflow carries every provenance guard", () => {
  assert.deepEqual(collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")), []);
});

test("the committed release workflow pairs credential-free checkout with git-mode changesets", () => {
  assert.deepEqual(
    collectReleaseChangesetsFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("commitMode github-api is rejected because it targets GITHUB_SHA instead of checkout HEAD", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const withGithubApi = workflow.replace(
    /(name: Version PR or publish\n {8}uses: changesets\/action@[^\n]+\n {8}with:\n)/,
    "$1          commitMode: github-api\n",
  );

  assert.ok(
    collectReleaseChangesetsFailures(withGithubApi).some((failure) =>
      failure.includes("must not set commitMode: github-api"),
    ),
  );
});

test("removing Install Chromium from either release job fails the collector", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const chromiumBlock = `      - name: Install Chromium
        run: pnpm --filter @diffgazer/web exec playwright install --with-deps chromium

`;
  const withoutReleaseChromium = workflow.replace(chromiumBlock, "");
  const withoutRecoveryChromium = workflow
    .replace(chromiumBlock, "__CHROMIUM_PLACEHOLDER__\n")
    .replace(chromiumBlock, "")
    .replace("__CHROMIUM_PLACEHOLDER__\n", chromiumBlock);

  assert.ok(
    collectReleaseChangesetsFailures(withoutReleaseChromium).some((failure) =>
      failure.includes("must install Chromium"),
    ),
  );
  assert.ok(
    collectReleaseChangesetsFailures(withoutRecoveryChromium).some((failure) =>
      failure.includes("must install Chromium"),
    ),
  );
});

test("dropping the ephemeral credential teardown from either release job fails the collector", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const teardownBlock = `      - name: Remove ephemeral git credentials
        if: always()
        run: git config --unset-all http.https://github.com/.extraheader || true
`;
  const withoutReleaseTeardown = workflow.replace(teardownBlock, "");
  const withoutRecoveryTeardown = workflow
    .replace(teardownBlock, "__TEARDOWN_PLACEHOLDER__\n")
    .replace(teardownBlock, "")
    .replace("__TEARDOWN_PLACEHOLDER__\n", teardownBlock);
  // A teardown that runs before the step it protects leaves the header live for
  // the whole publish, so position is as load-bearing as presence.
  const configureStep = "      - name: Configure ephemeral git credentials for changesets\n";
  const teardownBeforeChangesets = workflow
    .replace(teardownBlock, "")
    .replace(configureStep, `${teardownBlock}\n${configureStep}`);

  assert.ok(
    collectReleaseChangesetsFailures(withoutReleaseTeardown).some((failure) =>
      failure.includes("release must always unset the ephemeral git credential header"),
    ),
  );
  assert.ok(
    collectReleaseChangesetsFailures(withoutRecoveryTeardown).some((failure) =>
      failure.includes("recovery must always unset the ephemeral git credential header"),
    ),
  );
  const reordered = collectReleaseChangesetsFailures(teardownBeforeChangesets);
  assert.ok(
    reordered.some((failure) =>
      failure.includes("release must remove ephemeral git credentials after changesets"),
    ),
  );
  assert.ok(
    !reordered.some((failure) =>
      failure.includes("release must always unset the ephemeral git credential header"),
    ),
  );
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
    // Ancestry alone lets any merged commit publish: the readiness proof for the
    // exact SHA, and the API scope that reads it, are both load-bearing.
    workflow.replace(
      `      - name: ${RECOVERY_READINESS_GATE_STEP}`,
      "      - name: Skip the gate",
    ),
    workflow.replace("      actions: read\n", ""),
    // workflow_dispatch runs the definition from the selected ref, so the input-SHA
    // guards above say nothing about which copy of these steps reaches NPM_TOKEN.
    workflow.replace('"${RELEASE_REF}" != "refs/heads/main"', "false"),
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
