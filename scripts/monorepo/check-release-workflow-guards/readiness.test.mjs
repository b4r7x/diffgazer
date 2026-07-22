import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectDeployReadinessLinkFailures } from "./deploy.mjs";
import {
  collectChangesetStatusGuardFailures,
  REQUIRED_BROWSER_E2E_STEPS,
  shouldRunChangesetStatus,
} from "./readiness.mjs";
import { DEPLOY_WORKFLOW_PATH, RELEASE_READINESS_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed readiness workflow carries the exact Changesets PR identity guard", () => {
  assert.deepEqual(
    collectChangesetStatusGuardFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("the deploy gate names exactly the jobs defined by release readiness", () => {
  const deploy = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const readiness = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  assert.deepEqual(collectDeployReadinessLinkFailures(deploy, readiness), []);
  const mismatches = [
    [
      deploy.replace(
        '            "Browser E2E (Playwright + axe + visual)"',
        '            "Old E2E"',
      ),
      readiness,
    ],
    [
      deploy,
      readiness.replace(
        "name: Browser E2E (Playwright + axe + visual)",
        "name: Renamed Browser Gate",
      ),
    ],
  ];
  for (const [deploySource, readinessSource] of mismatches) {
    assert.deepEqual(collectDeployReadinessLinkFailures(deploySource, readinessSource), [
      `${DEPLOY_WORKFLOW_PATH}: readiness job names must exactly match ${RELEASE_READINESS_WORKFLOW_PATH}`,
    ]);
  }
});

test("each new browser suite remains executable in release readiness", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  for (const requirement of REQUIRED_BROWSER_E2E_STEPS) {
    const weakened = workflow.replace(`run: ${requirement.run}`, "run: echo browser suite removed");
    assert.ok(
      collectChangesetStatusGuardFailures(weakened).includes(
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
      ),
    );
  }
});

test("only the repository-owned trusted Changesets PR skips status", () => {
  const trusted = {
    eventName: "pull_request",
    headRef: "changeset-release/main",
    headRepository: "diffgazer/diffgazer",
    repository: "diffgazer/diffgazer",
    pullRequestAuthor: "github-actions[bot]",
  };

  assert.equal(shouldRunChangesetStatus(trusted), false);
  assert.equal(
    shouldRunChangesetStatus({ ...trusted, headRepository: "attacker/diffgazer" }),
    true,
  );
  assert.equal(shouldRunChangesetStatus({ ...trusted, pullRequestAuthor: "contributor" }), true);
  assert.equal(shouldRunChangesetStatus({ ...trusted, headRef: "feature/release" }), true);
  assert.equal(shouldRunChangesetStatus({ ...trusted, eventName: "push" }), false);
});

test("a branch-only Changeset exemption is rejected", () => {
  const workflow = [
    "jobs:",
    "  verify:",
    "    steps:",
    "      - name: Changeset status",
    "        if: github.event_name == 'pull_request' && github.head_ref != 'changeset-release/main'",
    "        run: pnpm changeset status --since=origin/main",
  ].join("\n");

  assert.deepEqual(collectChangesetStatusGuardFailures(workflow), [
    `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step has an unexpected identity guard`,
    ...REQUIRED_BROWSER_E2E_STEPS.map(
      (requirement) =>
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
    ),
  ]);
});
