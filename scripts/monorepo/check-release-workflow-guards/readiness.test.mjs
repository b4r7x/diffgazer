import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import {
  collectChangesetStatusGuardFailures,
  collectReadinessConcurrencyFailures,
  collectReadinessGateLinkFailures,
  READINESS_GATES,
} from "./readiness.mjs";
import { CI_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed CI workflow runs Changeset status on every pull request", () => {
  assert.deepEqual(collectChangesetStatusGuardFailures(readFileSync(CI_WORKFLOW_PATH, "utf8")), []);
});

test("reintroducing the dead Version-PR identity exemption is rejected", () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const withDeadExemption = workflow.replace(
    "if: ${{ github.event_name == 'pull_request' }}",
    [
      "if: >-",
      "          ${{ github.event_name == 'pull_request'",
      "          && (github.head_ref != 'changeset-release/main'",
      "          || github.event.pull_request.head.repo.full_name != github.repository",
      "          || github.event.pull_request.user.login != 'github-actions[bot]') }}",
    ].join("\n"),
  );

  assert.deepEqual(collectChangesetStatusGuardFailures(withDeadExemption), [
    `${CI_WORKFLOW_PATH}: Changeset status step must use only the pull_request event guard`,
  ]);
});

test("the committed CI workflow never cancels a release-gating push run", () => {
  assert.deepEqual(collectReadinessConcurrencyFailures(readFileSync(CI_WORKFLOW_PATH, "utf8")), []);
});

test("the CI secret scan is named for its bounded event range", () => {
  const workflow = parseYaml(readFileSync(CI_WORKFLOW_PATH, "utf8"));
  const job = workflow?.jobs?.["history-secret-scan"];
  const scan = job?.steps?.find((step) => step?.uses?.startsWith("gitleaks/gitleaks-action@"));

  assert.equal(job?.name, "Gitleaks Event-Range Scan");
  assert.equal(scan?.name, "Gitleaks event-range scan");
  assert.equal(scan?.uses, "gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7");
  assert.doesNotMatch(`${job?.name}\n${scan?.name}`, /full[- ]history/i);
});

test("reverting CI concurrency to a shared, cancellable main group is rejected", () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const groupFailure = `${CI_WORKFLOW_PATH}: push runs must get a per-commit concurrency group keyed on github.sha`;
  const cancelFailure = `${CI_WORKFLOW_PATH}: cancel-in-progress must exclude push events so a release-gating CI run is never cancelled`;

  const reverted = workflow
    .replace(
      "group: ci-${{ github.event_name == 'push' && github.sha || github.ref }}",
      "group: ci-${{ github.ref }}",
    )
    .replace("cancel-in-progress: ${{ github.event_name != 'push' }}", "cancel-in-progress: true");

  assert.deepEqual(collectReadinessConcurrencyFailures(reverted), [groupFailure, cancelFailure]);
  assert.deepEqual(
    collectReadinessConcurrencyFailures(
      workflow.replace(
        "group: ci-${{ github.event_name == 'push' && github.sha || github.ref }}",
        "group: ci-${{ github.ref }}",
      ),
    ),
    [groupFailure],
  );
  assert.deepEqual(
    collectReadinessConcurrencyFailures(
      workflow.replace(
        "cancel-in-progress: ${{ github.event_name != 'push' }}",
        "cancel-in-progress: true",
      ),
    ),
    [cancelFailure],
  );
  // Never cancelling at all keeps the release contract, so it stays accepted.
  assert.deepEqual(
    collectReadinessConcurrencyFailures(
      workflow.replace(
        "cancel-in-progress: ${{ github.event_name != 'push' }}",
        "cancel-in-progress: false",
      ),
    ),
    [],
  );
});

test("every privileged SHA gate names exactly the jobs defined by CI", () => {
  const ci = readFileSync(CI_WORKFLOW_PATH, "utf8");

  for (const gate of READINESS_GATES) {
    const workflow = readFileSync(gate.path, "utf8");
    assert.deepEqual(collectReadinessGateLinkFailures(gate, workflow, ci), []);

    const mismatches = [
      [
        workflow.replace('            "Build, Type-Check, and Test"', '            "Old Verify"'),
        ci,
      ],
      [workflow, ci.replace("name: Build, Type-Check, and Test", "name: Renamed CI Gate")],
    ];
    for (const [workflowSource, ciSource] of mismatches) {
      assert.deepEqual(collectReadinessGateLinkFailures(gate, workflowSource, ciSource), [
        `${gate.path}: CI job names must exactly match ${CI_WORKFLOW_PATH}`,
      ]);
    }
  }
});

test("removing a privileged SHA gate step is rejected", () => {
  const ci = readFileSync(CI_WORKFLOW_PATH, "utf8");

  for (const gate of READINESS_GATES) {
    const withoutGate = readFileSync(gate.path, "utf8").replace(
      `      - name: ${gate.stepName}`,
      "      - name: Something else entirely",
    );

    assert.deepEqual(collectReadinessGateLinkFailures(gate, withoutGate, ci), [
      `${gate.path}: ${gate.jobId} must require a successful CI run for the selected SHA`,
    ]);
  }
});

test("a branch-only Changeset exemption is rejected", () => {
  const workflow = [
    "jobs:",
    "  ci:",
    "    steps:",
    "      - name: Changeset status",
    "        if: github.event_name == 'pull_request' && github.head_ref != 'changeset-release/main'",
    "        run: pnpm changeset status --since=origin/main",
  ].join("\n");

  assert.deepEqual(collectChangesetStatusGuardFailures(workflow), [
    `${CI_WORKFLOW_PATH}: Changeset status step must use only the pull_request event guard`,
  ]);
});
