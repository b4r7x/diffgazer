import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  collectBrowserSuiteFailures,
  collectChangesetStatusGuardFailures,
  collectReadinessConcurrencyFailures,
  collectReadinessGateLinkFailures,
  READINESS_GATES,
  REQUIRED_BROWSER_E2E_STEPS,
} from "./readiness.mjs";
import { RELEASE_READINESS_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed readiness workflow runs Changeset status on every pull request", () => {
  assert.deepEqual(
    collectChangesetStatusGuardFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("reintroducing the dead Version-PR identity exemption is rejected", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");
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
    `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step must use only the pull_request event guard`,
  ]);
});

test("the committed readiness workflow never cancels a release-gating push run", () => {
  assert.deepEqual(
    collectReadinessConcurrencyFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("the readiness secret scan is named for its bounded event range", () => {
  const workflow = parseYaml(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8"));
  const job = workflow?.jobs?.["history-secret-scan"];
  const scan = job?.steps?.find((step) => step?.uses?.startsWith("gitleaks/gitleaks-action@"));

  assert.equal(job?.name, "Gitleaks Event-Range Scan");
  assert.equal(scan?.name, "Gitleaks event-range scan");
  assert.equal(scan?.uses, "gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7");
  assert.doesNotMatch(`${job?.name}\n${scan?.name}`, /full[- ]history/i);
});

test("reverting readiness concurrency to a shared, cancellable main group is rejected", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");
  const groupFailure = `${RELEASE_READINESS_WORKFLOW_PATH}: push runs must get a per-commit concurrency group keyed on github.sha`;
  const cancelFailure = `${RELEASE_READINESS_WORKFLOW_PATH}: cancel-in-progress must exclude push events so a release-gating readiness run is never cancelled`;

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

test("every privileged SHA gate names exactly the jobs defined by release readiness", () => {
  const readiness = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  for (const gate of READINESS_GATES) {
    const workflow = readFileSync(gate.path, "utf8");
    assert.deepEqual(collectReadinessGateLinkFailures(gate, workflow, readiness), []);

    const mismatches = [
      [
        workflow.replace(
          '            "Browser E2E (Playwright + axe + visual)"',
          '            "Old E2E"',
        ),
        readiness,
      ],
      [
        workflow,
        readiness.replace(
          "name: Browser E2E (Playwright + axe + visual)",
          "name: Renamed Browser Gate",
        ),
      ],
    ];
    for (const [workflowSource, readinessSource] of mismatches) {
      assert.deepEqual(collectReadinessGateLinkFailures(gate, workflowSource, readinessSource), [
        `${gate.path}: readiness job names must exactly match ${RELEASE_READINESS_WORKFLOW_PATH}`,
      ]);
    }
  }
});

test("removing a privileged SHA gate step is rejected", () => {
  const readiness = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  for (const gate of READINESS_GATES) {
    const withoutGate = readFileSync(gate.path, "utf8").replace(
      `      - name: ${gate.stepName}`,
      "      - name: Something else entirely",
    );

    assert.deepEqual(collectReadinessGateLinkFailures(gate, withoutGate, readiness), [
      `${gate.path}: ${gate.jobId} must require a successful Release Readiness run for the selected SHA`,
    ]);
  }
});

test("the committed readiness workflow still wires every browser suite", () => {
  assert.deepEqual(
    collectBrowserSuiteFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("each new browser suite remains executable in release readiness", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  for (const requirement of REQUIRED_BROWSER_E2E_STEPS) {
    const weakened = workflow.replace(`run: ${requirement.run}`, "run: echo browser suite removed");
    assert.ok(
      collectBrowserSuiteFailures(weakened).includes(
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
      ),
      requirement.name,
    );
  }
});

test("a suite that previews a tree built after it runs is rejected", () => {
  const workflow = parseYaml(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8"));
  const steps = workflow.jobs.e2e.steps;
  const buildIndex = steps.findIndex((step) => step?.name === "Build landing");
  const suiteIndex = steps.findIndex((step) => step?.name === "Run Landing Playwright tests");
  const [build] = steps.splice(buildIndex, 1);
  steps.splice(suiteIndex, 0, build);

  assert.deepEqual(collectBrowserSuiteFailures(stringifyYaml(workflow)), [
    `${RELEASE_READINESS_WORKFLOW_PATH}: Run Landing Playwright tests must come after Build landing`,
  ]);
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
    `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step must use only the pull_request event guard`,
  ]);
});
